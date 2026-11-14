begin;

alter table public.ae_actuator_commands drop constraint if exists ae_actuator_commands_action_check;
alter table public.ae_actuator_commands add constraint ae_actuator_commands_action_check
 check(action in ('pulse','session','stop'));

create or replace function public.ae_actuator_enqueue(p_user uuid,p_actuator text,p_action text,p_duration integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a ae_actuators; c ae_actuator_commands; role_name text;
begin
 select * into a from ae_actuators where id=p_actuator for update;
 if not found then raise exception 'Sprinkler tidak ditemukan'; end if;
 select m.role into role_name from ae_members m join ae_nodes n on n.location_id=m.location_id where m.user_id=p_user and n.id=a.node_id;
 if role_name is null or role_name not in ('admin','operator') then raise exception 'Akses pengelola lokasi diperlukan'; end if;
 select * into c from ae_actuator_commands where requested_by=p_user and request_id=p_request;
 if found then
  if c.actuator_id<>p_actuator or c.action<>p_action or c.duration_ms<>p_duration then raise exception 'Identitas permintaan sudah dipakai'; end if;
  return to_jsonb(c);
 end if;
 if p_action not in ('pulse','session','stop') or p_action is null then raise exception 'Tindakan tidak valid'; end if;
 if p_action<>'stop' then
  if not a.enabled then raise exception 'Sprinkler belum diaktifkan admin'; end if;
  if a.last_seen_at is null or a.last_seen_at<now()-interval '45 seconds' or a.status->>'state' is distinct from 'online' then raise exception 'Sprinkler sedang offline'; end if;
  if a.status->>'clock_synced' is distinct from 'true' or a.status->>'water_ok' is distinct from 'true' or a.status->>'manual_off'='true' or a.status->>'battery_ok' is distinct from 'true' then raise exception 'Periksa kesiapan perangkat, air, dan baterai'; end if;
  if p_action='session' then
   if a.status->'max_session_duration_ms' is distinct from '3600000'::jsonb then raise exception 'Perangkat belum mendukung sesi'; end if;
   if p_duration is null or p_duration not in (1800000,2700000,3600000) then raise exception 'Durasi sesi tidak valid'; end if;
  elsif p_duration is null or p_duration<1000 or p_duration>a.max_duration_ms then
   raise exception 'Durasi di luar batas perangkat';
  end if;
  if a.next_run_at>now() then raise exception 'Sprinkler masih dalam jeda operasi'; end if;
  if a.status->>'output'='on' or a.status->>'session_active'='true' or exists(
   select 1 from ae_actuator_commands where actuator_id=a.id and action in ('pulse','session')
   and state in ('queued','dispatching','published','accepted') and expires_at>now()
  ) then raise exception 'Masih ada perintah berjalan'; end if;
  update ae_actuators set next_run_at=now()+make_interval(secs=>
   case when p_action='session' then (p_duration+greatest(600000,a.cooldown_ms))/1000.0+30 else a.cooldown_ms/1000.0 end
  ) where id=a.id;
 else
  if p_duration is distinct from 0 then raise exception 'Durasi stop harus nol'; end if;
  update ae_actuator_commands set state='cancelled',updated_at=now(),reason='stop_requested'
   where actuator_id=a.id and state in ('queued','dispatching') and action in ('pulse','session');
 end if;
 insert into ae_actuator_commands(actuator_id,requested_by,request_id,action,duration_ms)
  values(a.id,p_user,p_request,p_action,p_duration) returning * into c;
 return to_jsonb(c);
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
  if c.action<>'stop' and (
   not a.enabled or a.last_seen_at<now()-interval '45 seconds' or a.last_seen_at is null
   or (c.trigger_band is not null and a.auto_metric is null)
   or (c.action='session' and (a.status->'max_session_duration_ms' is distinct from '3600000'::jsonb
       or a.status->>'state' is distinct from 'online'))
  ) then
   update ae_actuator_commands set state='rejected',reason='device_unavailable',updated_at=now() where id=c.id;
   continue;
  end if;
  update ae_actuator_commands set state='dispatching',dispatch_token=gen_random_uuid(),dispatch_until=now()+interval '8 seconds',attempts=attempts+1,updated_at=now() where id=c.id returning * into c;
  result:=result||jsonb_build_array(jsonb_build_object('id',c.id,'token',c.dispatch_token,'topic','aerosense/actuators/'||a.id||'/command','payload',jsonb_build_object(
   'version',1,'command_id',c.id,'actuator_id',a.id,'node_id',a.node_id,'source',case when c.trigger_band is null then 'web_manual' else 'sensor_threshold' end,
   'status',coalesce(c.trigger_band,'manual'),'action',c.action,'duration_ms',c.duration_ms,'cooldown_ms',case when c.trigger_band is null and c.action<>'session' then a.cooldown_ms else greatest(600000,a.cooldown_ms) end,
   'issued_at',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expires_at',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
 end loop;
 return result;
end $$;

create or replace function public.ae_actuator_ack(p_actuator text,p_id uuid,p_state text,p_reason text) returns boolean
language plpgsql security definer set search_path=public as $$
declare c ae_actuator_commands; a ae_actuators; release_session boolean:=false;
begin
 if p_state not in ('accepted','completed','rejected','fault') or p_state is null then raise exception 'Status ACK tidak valid'; end if;
 select * into a from ae_actuators where id=p_actuator for update;
 select * into c from ae_actuator_commands where id=p_id and actuator_id=p_actuator for update;
 if not found then return false; end if;
 if c.state in ('completed','rejected','fault','cancelled','stopped') then return false; end if;
 if c.state='accepted' and p_state in ('accepted','rejected') then return false; end if;
 if c.state='expired' and p_state='accepted' then return false; end if;
 update ae_actuator_commands set state=p_state,reason=left(p_reason,100),updated_at=now(),
  expires_at=case when c.action='session' and p_state='accepted'
   then now()+make_interval(secs=>c.duration_ms/1000.0+45) else c.expires_at end
 where id=c.id;
 release_session:=c.action='session' and p_state in ('completed','rejected','fault');
 if c.action='stop' and p_state='completed' then
  release_session:=exists(select 1 from ae_actuator_commands where actuator_id=p_actuator
   and action='session' and issued_at<=c.issued_at and expires_at>c.issued_at
   and state in ('queued','dispatching','published','accepted','expired','cancelled'));
  update ae_actuator_commands set state='stopped',reason='remote_stop',updated_at=now()
   where actuator_id=p_actuator and action in ('pulse','session') and issued_at<=c.issued_at
   and state in ('queued','dispatching','published','accepted','expired');
 end if;
 if release_session and not exists(select 1 from ae_actuator_commands where actuator_id=p_actuator
  and action in ('pulse','session') and issued_at>c.issued_at) then
  update ae_actuators set next_run_at=now()+make_interval(secs=>greatest(600000,a.cooldown_ms)/1000.0)
   where id=a.id;
 end if;
 return true;
end $$;

commit;
