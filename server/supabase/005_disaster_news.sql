-- Public headlines and monitoring notifications, not sensor measurements.
create table if not exists public.ae_disaster_news_cache (
  provider text primary key check (provider in ('gdacs','antara_humaniora','antara_terkini')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  refresh_after timestamptz,
  last_error text
);
alter table public.ae_disaster_news_cache enable row level security;
revoke all on public.ae_disaster_news_cache from anon, authenticated;
grant all on public.ae_disaster_news_cache to service_role;
