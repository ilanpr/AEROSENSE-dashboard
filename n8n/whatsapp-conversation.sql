WITH current_job AS MATERIALIZED (
 SELECT * FROM public.ae_jobs WHERE id=$1::uuid AND lease_token=$2::uuid
 AND kind='wa_chat' AND status='running' AND lease_until>now() FOR UPDATE
), progress AS (
 INSERT INTO public.ae_jobs(kind,dedupe_key,body)
 SELECT 'wa_send','progress:'||j.id,
 jsonb_build_object('phone',j.body->>'phone','text','Pertanyaan sedang diproses.','progress_reply',true)
 FROM current_job j
 WHERE j.body->>'phone' ~ '^[0-9]{8,15}$'
 AND j.created_at>now()-interval '2 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.ae_jobs q WHERE q.dedupe_key='reply:'||j.id)
 ON CONFLICT(dedupe_key) DO NOTHING RETURNING id
), prior AS (
 SELECT old.result->>'selected_node_id' AS node_id FROM public.ae_jobs old,current_job j
 WHERE old.kind='wa_inbox' AND old.status='done' AND old.body->>'phone'=j.body->>'phone'
 AND old.result->>'menu'='true' AND old.created_at<=j.created_at
 ORDER BY (old.result->>'inbound_at')::numeric DESC,old.created_at DESC LIMIT 1
), permitted AS (
 SELECT s.node_id FROM public.ae_subscriptions s JOIN public.ae_nodes n ON n.id=s.node_id AND n.enabled
 JOIN public.ae_members m ON m.user_id=s.user_id AND m.location_id=n.location_id
 JOIN current_job j ON s.phone=j.body->>'phone'
), chosen AS (
 SELECT node_id FROM permitted WHERE node_id=(SELECT node_id FROM prior)
), scoped AS (
 UPDATE public.ae_jobs j SET body=jsonb_set(j.body,'{node_ids}',
 CASE WHEN EXISTS(SELECT 1 FROM chosen) THEN (SELECT jsonb_agg(node_id) FROM chosen)
 ELSE coalesce((SELECT jsonb_agg(node_id ORDER BY node_id) FROM permitted),'[]'::jsonb) END),updated_at=now()
 FROM current_job c WHERE j.id=c.id RETURNING j.*
)
SELECT to_jsonb(scoped) AS job FROM scoped;
