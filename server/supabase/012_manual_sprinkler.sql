-- Manual WATERSENSE control. Apply after 001-011. No device is enabled by this migration.
begin;
create table if not exists public.ae_actuators (
 id text primary key check(id ~ '^[a-z0-9-]{1,40}$'),
 node_id text not null references public.ae_nodes(id), name text not null,
 enabled boolean not null default false,
 max_duration_ms integer not null default 10000 check(max_duration_ms between 1000 and 10000),
 cooldown_ms integer not null default 600000 check(cooldown_ms between 600000 and 86400000),
 next_run_at timestamptz, last_seen_at timestamptz, status jsonb not null default '{}'
);
create table if not exists public.ae_actuator_commands (
 id uuid primary key default gen_random_uuid(), actuator_id text not null references public.ae_actuators(id),
 requested_by uuid not null references auth.users(id), request_id uuid not null,
 action text not null check(action in ('pulse','stop')), duration_ms integer not null,
 state text not null default 'queued' check(state in ('queued','dispatching','published','accepted','completed','rejected','fault','expired','cancelled','stopped')),
 issued_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 seconds',
 updated_at timestamptz not null default now(), reason text,
 dispatch_token uuid, dispatch_until timestamptz, attempts integer not null default 0,
 unique(requested_by,request_id)
);
create index if not exists ae_actuator_queue on public.ae_actuator_commands(state,issued_at);
create index if not exists ae_actuator_history on public.ae_actuator_commands(actuator_id,issued_at desc);
alter table public.ae_actuators enable row level security;
alter table public.ae_actuator_commands enable row level security;
revoke all on public.ae_actuators,public.ae_actuator_commands from anon,authenticated;
grant all on public.ae_actuators,public.ae_actuator_commands to service_role;

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
 if p_action not in ('pulse','stop') or p_action is null then raise exception 'Tindakan tidak valid'; end if;
 if p_action='pulse' then
  if not a.enabled then raise exception 'Sprinkler belum diaktifkan admin'; end if;
  if a.last_seen_at is null or a.last_seen_at<now()-interval '45 seconds' or a.status->>'state'<>'online' then raise exception 'Sprinkler sedang offline'; end if;
  if a.status->>'clock_synced' is distinct from 'true' or a.status->>'water_ok' is distinct from 'true' or a.status->>'manual_off'='true' or a.status->>'battery_ok' is distinct from 'true' then raise exception 'Periksa kesiapan perangkat, air, dan baterai'; end if;
  if p_duration is null or p_duration<1000 or p_duration>a.max_duration_ms then raise exception 'Durasi di luar batas perangkat'; end if;
  if a.next_run_at>now() then raise exception 'Sprinkler masih dalam jeda operasi'; end if;
  if a.status->>'output'='on' or exists(select 1 from ae_actuator_commands where actuator_id=a.id and action='pulse' and state in ('queued','dispatching','published','accepted') and expires_at>now()) then raise exception 'Masih ada perintah berjalan'; end if;
  update ae_actuators set next_run_at=now()+make_interval(secs=>a.cooldown_ms/1000.0) where id=a.id;
 else
  if p_duration is distinct from 0 then raise exception 'Durasi stop harus nol'; end if;
  update ae_actuator_commands set state='cancelled',updated_at=now(),reason='stop_requested' where actuator_id=a.id and state in ('queued','dispatching') and action='pulse';
 end if;
 insert into ae_actuator_commands(actuator_id,requested_by,request_id,action,duration_ms) values(a.id,p_user,p_request,p_action,p_duration) returning * into c;
 return to_jsonb(c);
end $$;

create or replace function public.ae_actuator_claim() returns jsonb
language plpgsql security definer set search_path=public as $$
declare c ae_actuator_commands; a ae_actuators; result jsonb:='[]';
begin
 update ae_actuator_commands set state='expired',updated_at=now(),reason='ack_timeout' where expires_at<now() and state in ('queued','dispatching','published','accepted');
 delete from ae_actuator_commands where (state in ('completed','cancelled','stopped') and updated_at<now()-interval '2 days') or (state in ('rejected','fault','expired') and updated_at<now()-interval '7 days');
 for c in select * from ae_actuator_commands where expires_at>now() and attempts<3 and (state='queued' or (state='dispatching' and dispatch_until<now())) order by (action='stop') desc,issued_at limit 10 for update skip locked loop
  select * into a from ae_actuators where id=c.actuator_id;
  if c.action='pulse' and (not a.enabled or a.last_seen_at<now()-interval '45 seconds' or a.last_seen_at is null) then
   update ae_actuator_commands set state='rejected',reason='device_unavailable',updated_at=now() where id=c.id;
   continue;
  end if;
  update ae_actuator_commands set state='dispatching',dispatch_token=gen_random_uuid(),dispatch_until=now()+interval '8 seconds',attempts=attempts+1,updated_at=now() where id=c.id returning * into c;
  result:=result||jsonb_build_array(jsonb_build_object('id',c.id,'token',c.dispatch_token,'topic','aerosense/actuators/'||a.id||'/command','payload',jsonb_build_object(
   'version',1,'command_id',c.id,'actuator_id',a.id,'node_id',a.node_id,'source','web_manual','status','manual','action',c.action,'duration_ms',c.duration_ms,'cooldown_ms',a.cooldown_ms,
   'issued_at',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'expires_at',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
 end loop;
 return result;
end $$;
create or replace function public.ae_actuator_published(p_id uuid,p_token uuid) returns boolean
language sql security definer set search_path=public as $$
 with changed as(update ae_actuator_commands set state='published',updated_at=now() where id=p_id and dispatch_token=p_token and state='dispatching' returning id) select exists(select 1 from changed);
$$;
create or replace function public.ae_actuator_ack(p_actuator text,p_id uuid,p_state text,p_reason text) returns boolean
language plpgsql security definer set search_path=public as $$
declare c ae_actuator_commands;
begin
 if p_state not in ('accepted','completed','rejected','fault') or p_state is null then raise exception 'Status ACK tidak valid'; end if;
 select * into c from ae_actuator_commands where id=p_id and actuator_id=p_actuator for update;
 if not found then return false; end if;
 if c.state in ('completed','rejected','fault','cancelled','stopped') then return false; end if;
 if c.state='accepted' and p_state='rejected' then return false; end if;
 if c.state='expired' and p_state='accepted' then return false; end if;
 update ae_actuator_commands set state=p_state,reason=left(p_reason,100),updated_at=now() where id=c.id;
 if c.action='stop' and p_state='completed' then
  update ae_actuator_commands set state='stopped',reason='remote_stop',updated_at=now() where actuator_id=p_actuator and action='pulse' and issued_at<=c.issued_at and state in ('queued','dispatching','published','accepted','expired');
 end if;
 return true;
end $$;
revoke all on function public.ae_actuator_enqueue(uuid,text,text,integer,uuid),public.ae_actuator_claim(),public.ae_actuator_published(uuid,uuid),public.ae_actuator_ack(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ae_actuator_enqueue(uuid,text,text,integer,uuid),public.ae_actuator_claim(),public.ae_actuator_published(uuid,uuid),public.ae_actuator_ack(text,uuid,text,text) to service_role;
commit;
