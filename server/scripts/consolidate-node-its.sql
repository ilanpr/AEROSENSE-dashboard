begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table removed_nodes on commit drop as
select id from public.ae_nodes
where id in ('node-02', 'demo-its-01', 'demo-its-02', 'demo-its-03', 'demo-its-04');

do $$ begin
  if not exists (select 1 from public.ae_nodes where id = 'node-01' and name in ('Area Produksi Pabrik', 'Node 1 ITS')) then
    raise exception 'The retained node does not match the reviewed configuration';
  end if;
  if exists (select 1 from public.ae_nodes where id <> 'node-01' and id not in (select id from removed_nodes)) then
    raise exception 'An additional node appeared after the audit';
  end if;
  if exists (select 1 from public.ae_robots where node_id in (select id from removed_nodes)) then
    raise exception 'A removed node has a robot assignment';
  end if;
  if exists (select 1 from public.ae_actuators where node_id in (select id from removed_nodes) and id <> 'mist-01') then
    raise exception 'An unreviewed actuator assignment exists';
  end if;
  if exists (select 1 from public.ae_actuator_commands where actuator_id = 'mist-01' and state in ('queued', 'dispatching', 'published', 'accepted')) then
    raise exception 'Wait until the actuator has no active commands';
  end if;
  if exists (select 1 from public.ae_jobs j where j.status = 'running' and exists (
    select 1 from removed_nodes n where j.body->>'node_id' = n.id or j.body->'node_ids' @> jsonb_build_array(n.id)
  )) then
    raise exception 'A worker is still processing one of the removed nodes';
  end if;
end $$;

update public.ae_actuators
set node_id = 'node-01', name = 'WATERSENSE · Node 1 ITS'
where id = 'mist-01' and node_id = 'demo-its-01';

update public.ae_nodes set name = 'Node 1 ITS', public_read = true where id = 'node-01';

delete from public.ae_jobs j where exists (
  select 1 from removed_nodes n where j.body->>'node_id' = n.id or j.body->'node_ids' @> jsonb_build_array(n.id)
);
delete from public.ae_training_examples t
where t.node_id in (select id from removed_nodes)
   or t.reading_id in (select id from public.ae_readings where node_id in (select id from removed_nodes))
   or t.label_reading_id in (select id from public.ae_readings where node_id in (select id from removed_nodes));
delete from public.ae_quality_events where node_id in (select id from removed_nodes);
delete from public.ae_model_runs where node_id in (select id from removed_nodes);
delete from public.ae_alerts where node_id in (select id from removed_nodes);
delete from public.ae_latest where node_id in (select id from removed_nodes);
delete from public.ae_rules where node_id in (select id from removed_nodes);
delete from public.ae_pair_codes where node_id in (select id from removed_nodes);
delete from public.ae_subscriptions where node_id in (select id from removed_nodes);
delete from public.ae_readings where node_id in (select id from removed_nodes);
delete from public.ae_nodes where id in (select id from removed_nodes);
delete from public.ae_members m
where m.location_id in ('lokasi-kantor', 'demo-its')
  and not exists (select 1 from public.ae_nodes n where n.location_id = m.location_id);

commit;

select n.id, n.name, n.enabled, n.public_read,
  (select count(*) from public.ae_readings r where r.node_id = n.id) as readings,
  (select count(*) from public.ae_model_runs r where r.node_id = n.id) as model_runs,
  (select count(*) from public.ae_rules r where r.node_id = n.id) as rules,
  (select count(*) from public.ae_robots r where r.node_id = n.id) as robots,
  (select string_agg(a.id, ', ') from public.ae_actuators a where a.node_id = n.id) as actuators
from public.ae_nodes n;
