begin;

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
  if a.status->'manual_restart' is distinct from 'true'::jsonb and a.next_run_at>now() then raise exception 'Sprinkler masih dalam jeda operasi'; end if;
  if a.status->>'output'='on' or a.status->>'session_active'='true' or exists(
   select 1 from ae_actuator_commands where actuator_id=a.id
   and state in ('queued','dispatching','published','accepted') and expires_at>now()
  ) then raise exception 'Masih ada perintah berjalan'; end if;
  -- Reserve time for automatic scheduling. Manual restart-capable firmware can ignore this reservation.
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

commit;
