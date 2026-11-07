-- Apply after 001_aerosense.sql. Preserves existing rows and adds provenance.
begin;
alter table public.ae_readings add column if not exists raw_metrics jsonb;
alter table public.ae_readings add column if not exists raw_payload jsonb;
alter table public.ae_readings add column if not exists raw_sha256 text;
alter table public.ae_readings add column if not exists processing jsonb not null default '{}';
create table if not exists public.ae_model_runs (
 id uuid primary key default gen_random_uuid(), reading_id uuid not null references public.ae_readings,
 node_id text not null references public.ae_nodes, model_name text not null default 'GRU',
 model_version text not null, artifact_sha256 text, manifest_sha256 text,
 input_features jsonb not null, normalized_input jsonb, input_readings jsonb not null default '[]',
 output jsonb not null, processed_at timestamptz not null, predicted_for timestamptz not null,
 unique(reading_id,model_name,model_version)
);
create index if not exists ae_model_runs_node_time on public.ae_model_runs(node_id,processed_at desc);
alter table public.ae_model_runs enable row level security;
create policy model_runs_member on public.ae_model_runs for select to authenticated using(public.ae_can_read(node_id));
grant select on public.ae_model_runs to authenticated;
grant select,insert on public.ae_model_runs to service_role;
revoke all on public.ae_model_runs from anon;

create or replace function public.ae_ingest(p jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare r ae_readings; n ae_nodes; q jsonb;
begin
 select * into strict n from ae_nodes where id=p->>'node_id' and enabled;
 q:=coalesce(p->'quality','{}'::jsonb);
 if not q ? 'calibration_version' and n.calibration_version is not null then
  q:=q||jsonb_build_object('calibration_version',n.calibration_version);
 end if;
 insert into ae_readings(node_id,boot_id,sequence,observed_at,metrics,gru,quality,raw_metrics,raw_payload,raw_sha256,processing)
 values(n.id,p->>'boot_id',(p->>'sequence')::bigint,(p->>'observed_at')::timestamptz,p->'metrics',p->'gru',q,p->'raw_metrics',p->'raw_payload',p->>'raw_sha256',coalesce(p->'processing','{}'))
 on conflict(node_id,boot_id,sequence) do nothing returning * into r;
 if r.id is null then return jsonb_build_object('duplicate',true); end if;
 if p->'gru' is not null and p->'gru'<>'null'::jsonb then
  insert into ae_model_runs(reading_id,node_id,model_version,artifact_sha256,manifest_sha256,input_features,normalized_input,input_readings,output,processed_at,predicted_for)
  values(r.id,n.id,p->'gru'->>'model_version',p->'gru'->>'artifact_sha256',p->'gru'->>'manifest_sha256',coalesce(p->'gru'->'input_features',r.metrics),p->'gru'->'normalized_input',coalesce(p->'gru'->'input_readings','[]'),p->'gru',coalesce((p->'gru'->>'processed_at')::timestamptz,now()),r.observed_at+make_interval(secs=>coalesce((p->'gru'->>'horizon_seconds')::int,0)));
 end if;
 insert into ae_latest values(n.id,r.id,r.observed_at,r.received_at,r.metrics,r.gru,r.quality)
 on conflict(node_id) do update set reading_id=excluded.reading_id,observed_at=excluded.observed_at,received_at=excluded.received_at,metrics=excluded.metrics,gru=excluded.gru,quality=excluded.quality
 where ae_latest.observed_at < excluded.observed_at;
 insert into ae_jobs(kind,dedupe_key,body) values('telemetry','reading:'||r.id,jsonb_build_object('reading_id',r.id));
 return jsonb_build_object('reading_id',r.id,'duplicate',false);
end $$;
revoke execute on function public.ae_ingest(jsonb) from public,anon,authenticated;
grant execute on function public.ae_ingest(jsonb) to service_role;

create or replace view public.ae_sensor_context with (security_invoker=true) as
 select n.id as node_id,n.name,n.latitude,n.longitude,n.pm25_validated,l.reading_id,l.observed_at,l.received_at,
 coalesce(l.metrics,'{}'::jsonb) as metrics,l.gru,coalesce(l.quality,'{}'::jsonb) as quality,
 (l.observed_at is null or l.observed_at<now()-interval '10 minutes') as stale
 from public.ae_nodes n left join public.ae_latest l on l.node_id=n.id where n.enabled;
grant select on public.ae_sensor_context to authenticated,service_role;
revoke all on public.ae_sensor_context from anon;

create table if not exists public.ae_training_sets (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 created_at timestamptz not null default now(), window_start timestamptz not null,window_end timestamptz not null,
 target text not null, horizon_seconds int not null, rows_count int not null default 0,
 status text not null default 'snapshot_ready', manifest jsonb not null
);
create table if not exists public.ae_training_examples (
 dataset_id uuid not null references public.ae_training_sets,reading_id uuid not null references public.ae_readings,
 label_reading_id uuid not null references public.ae_readings,node_id text not null,
 input_at timestamptz not null,label_at timestamptz not null,input_metrics jsonb not null,raw_metrics jsonb,raw_payload jsonb,
 label_value double precision not null,quality jsonb not null,
 primary key(dataset_id,reading_id)
);
alter table public.ae_training_sets enable row level security;
alter table public.ae_training_examples enable row level security;
revoke all on public.ae_training_sets,public.ae_training_examples from anon,authenticated;
grant select,insert,update on public.ae_training_sets,public.ae_training_examples to service_role;

create or replace function public.ae_training_snapshot(p_key text,p_start timestamptz,p_end timestamptz,p_target text default 'dust_ug_m3',p_horizon int default 300) returns jsonb language plpgsql security definer set search_path=public as $$
declare d uuid; count_rows int;
begin
 if p_start>=p_end or p_end-p_start>interval '31 days' or p_horizon not between 0 and 86400 or p_target not in ('dust_ug_m3','pm25_ug_m3','eco2_ppm','tvoc_ppb','temperature_c','humidity_pct') then raise exception 'Invalid dataset window'; end if;
 -- Serialize only the same snapshot key; chat and telemetry workers are unaffected.
 perform pg_advisory_xact_lock(hashtextextended(p_key,0));
 select id into d from ae_training_sets where dedupe_key=p_key;
 if d is not null then return (select jsonb_build_object('dataset_id',id,'rows_count',rows_count,'status',status) from ae_training_sets where id=d);end if;
 insert into ae_training_sets(dedupe_key,window_start,window_end,target,horizon_seconds,manifest)
 values(p_key,p_start,p_end,p_target,p_horizon,jsonb_build_object('label_source','future_sensor_measurement','window_builder_required',true,'split_required','chronological_with_purge','do_not_train_on_gru_predictions',true)) returning id into d;
 insert into ae_training_examples(dataset_id,reading_id,label_reading_id,node_id,input_at,label_at,input_metrics,raw_metrics,raw_payload,label_value,quality)
 select d,r.id,label.id,r.node_id,r.observed_at,label.observed_at,r.metrics,r.raw_metrics,r.raw_payload,(label.metrics->>p_target)::double precision,r.quality
 from ae_readings r join ae_nodes n on n.id=r.node_id
 cross join lateral (
  select t.* from ae_readings t where t.node_id=r.node_id and t.observed_at>=r.observed_at+make_interval(secs=>p_horizon)
  and t.observed_at<=r.observed_at+make_interval(secs=>p_horizon+60) and t.observed_at<=p_end
  and t.metrics ? p_target and coalesce((t.quality->>'invalid')::boolean,false)=false
  and t.quality->>'calibration_version'=r.quality->>'calibration_version'
  order by t.observed_at,t.id limit 1
 ) label
 where r.observed_at>=p_start and r.observed_at<p_end and jsonb_typeof(r.raw_payload)='object'
 and coalesce((r.quality->>'invalid')::boolean,false)=false and r.quality->>'calibration_version' is not null
 and (p_target<>'pm25_ug_m3' or n.pm25_validated);
 get diagnostics count_rows = row_count;
 update ae_training_sets set rows_count=count_rows,status=case when count_rows=0 then 'insufficient_data' else 'snapshot_ready' end where id=d;
 return jsonb_build_object('dataset_id',d,'rows_count',count_rows,'status',case when count_rows=0 then 'insufficient_data' else 'snapshot_ready' end);
end $$;
revoke execute on function public.ae_training_snapshot(text,timestamptz,timestamptz,text,int) from public,anon,authenticated;
grant execute on function public.ae_training_snapshot(text,timestamptz,timestamptz,text,int) to service_role;
create or replace function public.ae_ready_kinds() returns table(kind text) language sql security definer set search_path=public as $$
 select distinct j.kind from ae_jobs j where (j.status='pending' and j.available_at<=now())
 or (j.status='running' and j.lease_until<now());
$$;
revoke execute on function public.ae_ready_kinds() from public,anon,authenticated;
grant execute on function public.ae_ready_kinds() to service_role;
commit;
