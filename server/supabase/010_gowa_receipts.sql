begin;
create table if not exists public.ae_wa_receipts (
  device_jid text not null,
  message_id text not null,
  phone text not null check (phone ~ '^\d{8,15}$'),
  status text not null check (status in ('sent','delivered','read','played')),
  updated_at timestamptz not null default now(),
  primary key (device_jid,message_id)
);
alter table public.ae_wa_receipts enable row level security;
revoke all on public.ae_wa_receipts from anon, authenticated;
grant all on public.ae_wa_receipts to service_role;
create index if not exists ae_wa_receipts_age_idx on public.ae_wa_receipts(updated_at);
create or replace function public.ae_gowa_receipt(p_device text,p_id text,p_phone text,p_status text)
returns void language sql security definer set search_path=public as $$
  insert into ae_wa_receipts(device_jid,message_id,phone,status)
  values(p_device,p_id,p_phone,p_status)
  on conflict(device_jid,message_id) do update set
    status=excluded.status,updated_at=now()
  where ae_wa_receipts.phone=excluded.phone and
    array_position(array['sent','delivered','read','played'],excluded.status) >
    array_position(array['sent','delivered','read','played'],ae_wa_receipts.status);
$$;
revoke all on function public.ae_gowa_receipt(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ae_gowa_receipt(text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
