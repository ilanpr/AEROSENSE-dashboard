-- Read-only capacity audit. No job, sensor or training rows are changed.
SELECT jsonb_build_object(
 'database_size',pg_size_pretty(pg_database_size(current_database())),
 'tables',(SELECT jsonb_agg(t ORDER BY bytes DESC) FROM (
   SELECT relname,n_live_tup AS estimated_rows,pg_total_relation_size(relid) AS bytes,
          pg_size_pretty(pg_total_relation_size(relid)) AS total_size
   FROM pg_stat_user_tables WHERE schemaname='public' AND relname LIKE 'ae_%'
 ) t),
 'jobs',(SELECT jsonb_agg(t) FROM (
   SELECT kind,status,count(*) AS rows,min(created_at) AS oldest,
          pg_size_pretty(sum(pg_column_size(body)+pg_column_size(stage)+coalesce(pg_column_size(result),0))::bigint) AS payload_size
   FROM public.ae_jobs GROUP BY kind,status
 ) t),
 'commands',(SELECT jsonb_agg(t) FROM (
   SELECT state,count(*) AS rows,min(created_at) AS oldest FROM public.ae_commands GROUP BY state
 ) t),
 'maintenance_definition',pg_get_functiondef('public.ae_maintenance()'::regprocedure)
) AS storage_audit;
