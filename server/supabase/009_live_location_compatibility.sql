-- Compatibility repair for live databases still using city-reference areas.
-- Additive: preserve old cache and all readings; existing nodes remain private.
begin;

alter table public.ae_environment_areas
  drop constraint if exists ae_environment_areas_id_check;
alter table public.ae_environment_areas
  add constraint ae_environment_areas_id_check
  check (id ~ '^[a-zA-Z0-9_-]{1,48}$');
alter table public.ae_environment_areas
  add column if not exists source_node_id text references public.ae_nodes(id) on delete cascade;
create unique index if not exists ae_environment_areas_source_node_uidx
  on public.ae_environment_areas(source_node_id) where source_node_id is not null;

create or replace function public.ae_sync_environment_node()
returns trigger language plpgsql security definer set search_path=public as $$
declare area_key text := 'node_' || new.id;
begin
insert into public.ae_environment_areas(
    id, name, latitude, longitude, coordinate_source, timezone, enabled, source_node_id
  ) values (
    area_key, new.name, new.latitude, new.longitude, 'robot_node', 'Asia/Jakarta', new.enabled, new.id
  )
  on conflict (source_node_id) where source_node_id is not null
  do update set
    name = excluded.name,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    enabled = excluded.enabled;
  return new;
end $$;

drop trigger if exists ae_sync_environment_node on public.ae_nodes;
create trigger ae_sync_environment_node
after insert or update of name, latitude, longitude, enabled on public.ae_nodes
for each row execute function public.ae_sync_environment_node();

insert into public.ae_environment_areas(
  id, name, latitude, longitude, coordinate_source, timezone, enabled, source_node_id
)
select 'node_' || n.id, n.name, n.latitude, n.longitude, 'robot_node', 'Asia/Jakarta', n.enabled, n.id
from public.ae_nodes n
on conflict (source_node_id) where source_node_id is not null
do update set
  name = excluded.name, latitude = excluded.latitude,
  longitude = excluded.longitude, enabled = excluded.enabled;

-- Disable legacy areas reversibly; retain their old cache for rollback.
update public.ae_environment_areas set enabled=false where source_node_id is null and enabled;

-- Apply before deploying the guest monitoring API. Existing nodes stay private.
alter table public.ae_nodes add column if not exists public_read boolean not null default false;
comment on column public.ae_nodes.public_read is 'Operator opt-in: publishes node coordinates, sensor history and regional context through the read-only backend API.';


-- Optional danger threshold. No regulatory or health thresholds are inferred.
alter table public.ae_rules add column if not exists danger_high double precision;
alter table public.ae_rules drop constraint if exists ae_rules_danger_high_check;
alter table public.ae_rules add constraint ae_rules_danger_high_check
  check (danger_high is null or (danger_high > high and danger_high < 'Infinity'::float8));
comment on column public.ae_rules.danger_high is 'Operator-defined escalation level in the same sensor unit. Null means no danger band is configured; not an AQI/ISPU health classification.';

notify pgrst, 'reload schema';
commit;
select id,source_node_id,coordinate_source,enabled from public.ae_environment_areas where enabled order by id;
