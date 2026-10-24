-- Bind public environment cache rows to the coordinates of each enabled sensor/robot node.
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
  if tg_op = 'UPDATE' and (
    old.latitude is distinct from new.latitude or
    old.longitude is distinct from new.longitude or
    old.enabled is distinct from new.enabled
  ) then
    delete from public.ae_environment_area_cache where area_id = area_key;
  end if;

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

-- Retire city-wide sample areas and their cached API snapshots.
update public.ae_environment_areas
set enabled = false
where source_node_id is null and enabled;
delete from public.ae_environment_area_cache c
using public.ae_environment_areas a
where c.area_id = a.id and a.source_node_id is null;

commit;
