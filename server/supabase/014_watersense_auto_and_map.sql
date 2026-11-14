begin;

alter table public.ae_actuators
 add column if not exists latitude double precision,
 add column if not exists longitude double precision,
 add column if not exists auto_metric text;
alter table public.ae_actuators
 drop constraint if exists ae_actuators_coordinates_check,
 drop constraint if exists ae_actuators_auto_metric_check;
alter table public.ae_actuators
 add constraint ae_actuators_coordinates_check check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null and latitude between -85 and 85 and longitude between -180 and 180)
 ),
 add constraint ae_actuators_auto_metric_check check (auto_metric in ('dust_ug_m3','pm25_ug_m3'));

alter table public.ae_actuator_commands
 alter column requested_by drop not null,
 add column if not exists trigger_band text check (trigger_band in ('warning','danger'));
create unique index if not exists ae_actuator_auto_reading on public.ae_actuator_commands(actuator_id,request_id)
 where trigger_band is not null;

create or replace function public.ae_actuator_schedule_auto() returns void
language plpgsql set search_path=public as $$
declare a ae_actuators; r ae_rules; reading uuid; lowest numeric; band text;
begin
 for a in
  select * from ae_actuators
  where enabled and auto_metric is not null
    and (next_run_at is null or next_run_at<=now())
    and last_seen_at between now()-interval '45 seconds' and now()
    and status->>'state'='online' and status->>'output'='off'
    and status->>'clock_synced'='true' and status->>'battery_ok'='true'
    and status->>'water_ok'='true' and status->>'manual_off' is distinct from 'true'
  order by id for update skip locked
 loop
  if exists (
   select 1 from ae_actuator_commands c where c.actuator_id=a.id and (
    (c.action='stop' and c.issued_at>now()-interval '10 minutes') or
    (c.action='pulse' and c.expires_at>now() and c.state in ('queued','dispatching','published','accepted'))
   )
  ) then continue; end if;

  select rules.* into r from ae_rules rules join ae_nodes n on n.id=rules.node_id
  where n.id=a.node_id and n.enabled and rules.enabled and rules.metric=a.auto_metric
    and (a.auto_metric<>'pm25_ug_m3' or n.pm25_validated);
  if not found then continue; end if;

  select (array_agg(s.id order by s.observed_at desc,s.id desc))[1],
         min(case when jsonb_typeof(s.metrics->a.auto_metric)='number'
             then (s.metrics->>a.auto_metric)::numeric end)
  into reading,lowest
  from (
   select id,observed_at,metrics,quality,boot_id from ae_readings where node_id=a.node_id
   order by observed_at desc,id desc limit 3
  ) s
  having count(distinct s.observed_at)=3 and max(s.observed_at)>=now()-interval '2 minutes' and bool_and(
   s.observed_at between now()-interval '12 minutes' and now()+interval '5 seconds'
   and s.quality->>'invalid' is distinct from 'true'
   and s.quality->>'simulation' is distinct from 'true'
   and coalesce(s.quality->>'data_origin','') !~* 'syntheti|simulat|mock|demo'
   and s.boot_id !~* '^(mock|simulat|synthetic|demo)'
   and coalesce(jsonb_typeof(s.metrics->a.auto_metric)='number',false)
   and (case when jsonb_typeof(s.metrics->a.auto_metric)='number'
        then (s.metrics->>a.auto_metric)::numeric between 0 and 1000000 else false end)
  );
  if not found or lowest<r.high then continue; end if;

  band:=case when lowest>=r.danger_high then 'danger' else 'warning' end;
  insert into ae_actuator_commands(actuator_id,request_id,action,duration_ms,trigger_band)
   values(a.id,reading,'pulse',least(a.max_duration_ms,case when band='danger' then 5000 else 3000 end),band)
   on conflict (actuator_id,request_id) where trigger_band is not null do nothing;
  if found then
   update ae_actuators set next_run_at=now()+make_interval(secs=>greatest(600000,a.cooldown_ms)/1000.0)
   where id=a.id;
  end if;
 end loop;
end $$;

create or replace function public.ae_actuator_claim() returns jsonb
language plpgsql security definer set search_path=public as $$
declare c ae_actuator_commands; a ae_actuators; result jsonb:='[]';
begin
 perform ae_actuator_schedule_auto();
 update ae_actuator_commands set state='expired',updated_at=now(),reason='ack_timeout' where expires_at<now() and state in ('queued','dispatching','published','accepted');
 delete from ae_actuator_commands where (state in ('completed','cancelled','stopped') and updated_at<now()-interval '2 days') or (state in ('rejected','fault','expired') and updated_at<now()-interval '7 days');
 for c in select * from ae_actuator_commands where expires_at>now() and attempts<3 and (state='queued' or (state='dispatching' and dispatch_until<now())) order by (action='stop') desc,issued_at limit 10 for update skip locked loop
  select * into a from ae_actuators where id=c.actuator_id;
  if c.action='pulse' and (not a.enabled or a.last_seen_at<now()-interval '45 seconds' or a.last_seen_at is null or (c.trigger_band is not null and a.auto_metric is null)) then
   update ae_actuator_commands set state='rejected',reason='device_unavailable',updated_at=now() where id=c.id;
   continue;
  end if;
  update ae_actuator_commands set state='dispatching',dispatch_token=gen_random_uuid(),dispatch_until=now()+interval '8 seconds',attempts=attempts+1,updated_at=now() where id=c.id returning * into c;
  result:=result||jsonb_build_array(jsonb_build_object('id',c.id,'token',c.dispatch_token,'topic','aerosense/actuators/'||a.id||'/command','payload',jsonb_build_object(
   'version',1,'command_id',c.id,'actuator_id',a.id,'node_id',a.node_id,'source',case when c.trigger_band is null then 'web_manual' else 'sensor_threshold' end,
   'status',coalesce(c.trigger_band,'manual'),'action',c.action,'duration_ms',c.duration_ms,'cooldown_ms',case when c.trigger_band is null then a.cooldown_ms else greatest(600000,a.cooldown_ms) end,
   'issued_at',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expires_at',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
 end loop;
 return result;
end $$;

revoke all on function public.ae_actuator_schedule_auto() from public,anon,authenticated,service_role;
commit;
