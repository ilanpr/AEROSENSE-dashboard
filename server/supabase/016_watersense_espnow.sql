begin;
alter table public.ae_actuators
 add column if not exists espnow_auto boolean not null default false,
 add column if not exists espnow_duration_ms integer not null default 1800000
 check (espnow_duration_ms in (1800000,2700000,3600000));

create or replace function public.ae_actuator_schedule_auto() returns void
language plpgsql set search_path=public as $$
declare a ae_actuators; r ae_rules; reading uuid; lowest numeric; band text;
begin
 for a in
  select * from ae_actuators
  where enabled and not espnow_auto and auto_metric is not null
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


create or replace function public.ae_actuator_cancel_cloud_auto() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.espnow_auto and not old.espnow_auto then
  update ae_actuator_commands set state='cancelled',reason='espnow_mode',updated_at=now()
   where actuator_id=new.id and trigger_band is not null and state in ('queued','dispatching');
 end if;
 return new;
end $$;
drop trigger if exists ae_actuator_cancel_cloud_auto on public.ae_actuators;
create trigger ae_actuator_cancel_cloud_auto after update of espnow_auto on public.ae_actuators
 for each row execute function public.ae_actuator_cancel_cloud_auto();
commit;
