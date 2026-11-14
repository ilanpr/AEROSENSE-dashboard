-- WhatsApp for published nodes: any account may subscribe (DAFTAR code) to a node its admin published, and
-- alerts reach those subscribers. Private nodes still require a membership of the node's location.
begin;

create or replace function public.ae_pair(p_hash text, p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare c ae_pair_codes; n ae_nodes;
begin
 select * into c from ae_pair_codes where code_hash=p_hash and expires_at>now() for update;
 if c.code_hash is null then return null; end if;
 if c.used_at is not null and c.used_by is distinct from p_phone then return null; end if;
 select * into strict n from ae_nodes where id=c.node_id;
 if not ((n.public_read and n.enabled)
         or exists(select 1 from ae_members where user_id=c.user_id and location_id=n.location_id)) then
  return null;
 end if;
 update ae_pair_codes set used_at=coalesce(used_at,now()),used_by=p_phone where code_hash=p_hash;
 insert into ae_subscriptions(phone,node_id,user_id) values(p_phone,c.node_id,c.user_id)
 on conflict(phone,node_id) do update set user_id=excluded.user_id,active=true,opted_in_at=now();
 return n.name;
end $$;

create or replace function public.ae_queue_wa(p_node public.ae_nodes, p_key text, p_text text,
  p_alert uuid, p_vars jsonb) returns void language sql security definer set search_path=public as $$
 insert into ae_jobs(kind,dedupe_key,owner_id,body)
 select 'wa_send',p_key||':'||s.phone,s.user_id,
  jsonb_build_object('phone',s.phone,'text',p_text,'alert_id',p_alert,'node_id',p_node.id,'template_vars',p_vars)
 from ae_subscriptions s where s.node_id=p_node.id and s.active
  and (p_node.public_read
       or exists(select 1 from ae_members m where m.user_id=s.user_id and m.location_id=p_node.location_id))
 on conflict(dedupe_key) do nothing
$$;

commit;
