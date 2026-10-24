SELECT
 (SELECT jsonb_build_object('id',n.id,'enabled',n.enabled,'pm25_validated',n.pm25_validated) FROM public.ae_nodes n WHERE n.id=$1) AS node,
 (SELECT to_jsonb(r) FROM public.ae_rules r WHERE r.node_id=$1 AND r.metric=$2) AS rule,
 COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.observed_at DESC) FROM
   (SELECT id,node_id,observed_at,metrics,quality FROM public.ae_readings WHERE node_id=$1 ORDER BY observed_at DESC LIMIT 10) t),'[]'::jsonb) AS readings;
