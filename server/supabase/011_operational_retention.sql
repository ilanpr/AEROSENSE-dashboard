-- Review before applying. Alters the existing maintenance function, not sensor history.
-- Keep two days of successful jobs for WhatsApp's 24h menu context and web TTS.
begin;
create or replace function public.ae_maintenance() returns jsonb
language plpgsql security definer set search_path=public as $$
declare n ae_nodes; total int:=0; deleted_jobs int:=0; deleted_commands int:=0;
begin
 for n in select x.* from ae_nodes x left join ae_latest l on l.node_id=x.id
 where x.enabled and (l.observed_at is null or l.observed_at<now()-interval '15 minutes') loop
  insert into ae_jobs(kind,dedupe_key,status,body,result)
  values('operational','offline:'||n.id||':'||to_char(now(),'YYYYMMDDHH24'),'done',
   jsonb_build_object('node_id',n.id,'reason','Sensor tidak mengirim data terbaru selama 15 menit'),
   jsonb_build_object('stale',true)) on conflict(dedupe_key) do nothing;
  total:=total+1;
 end loop;
 update ae_commands set state='expired' where expires_at<now() and state in ('pending','leased');
 delete from ae_pair_codes where expires_at<now()-interval '1 day';
 delete from ae_jobs where
  (status='done' and updated_at<now()-interval '2 days') or
  (status='failed' and updated_at<now()-interval '7 days');
 get diagnostics deleted_jobs=row_count;
 -- Backend /internal/maintenance must remove stored audio first. Preserve pending/leased commands.
 delete from ae_commands where coalesce(body->>'audio_path','')='' and (
  (state in ('done','expired') and coalesce(completed_at,expires_at,created_at)<now()-interval '1 day') or
  (state='failed' and coalesce(completed_at,created_at)<now()-interval '7 days')
 );
 get diagnostics deleted_commands=row_count;
 return jsonb_build_object('stale_nodes',total,'deleted_jobs',deleted_jobs,'deleted_commands',deleted_commands);
end $$;
commit;
