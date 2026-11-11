-- Accounts: optional profile at sign-up, role requests reviewed by the AEROSENSE team, and the team list.
-- Every new account is a warga (viewer of published nodes) until a staff member approves a role for a location.
-- Tables are reached only through the API with the service role; anon and authenticated get nothing.
begin;

create table if not exists public.ae_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) between 2 and 80),
  organization text check (organization is null or char_length(organization) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9]{8,15}$'),
  address text check (address is null or char_length(address) <= 240),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ae_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  requested_role text not null check (requested_role in ('operator','auditor','admin')),
  organization text check (organization is null or char_length(organization) <= 120),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  location_id text,
  granted_role text check (granted_role is null or granted_role in ('viewer','operator','auditor','admin')),
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists ae_role_requests_one_pending on public.ae_role_requests(user_id) where status = 'pending';
create index if not exists ae_role_requests_status on public.ae_role_requests(status, created_at);

-- AEROSENSE team members who verify role requests. Not a location role.
create table if not exists public.ae_staff (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.ae_profiles enable row level security;
alter table public.ae_role_requests enable row level security;
alter table public.ae_staff enable row level security;
revoke all on public.ae_profiles, public.ae_role_requests, public.ae_staff from anon, authenticated;

-- Bootstrap: the current location admins are the AEROSENSE team. Edit ae_staff to change who verifies.
insert into public.ae_staff(user_id) select distinct user_id from public.ae_members where role = 'admin'
on conflict do nothing;

-- Approve or reject in one transaction: staff check, request still pending, membership written.
create or replace function public.ae_review_role_request(
  p_request uuid, p_staff uuid, p_action text, p_location text, p_role text, p_note text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r ae_role_requests;
begin
  if not exists(select 1 from ae_staff where user_id = p_staff) then
    raise exception 'Hanya tim AEROSENSE yang dapat memverifikasi peran' using errcode = '42501';
  end if;
  select * into r from ae_role_requests where id = p_request and status = 'pending' for update;
  if r.id is null then raise exception 'Permintaan tidak ditemukan atau sudah diproses' using errcode = 'P0002'; end if;
  if p_action = 'reject' then
    update ae_role_requests set status = 'rejected', reviewed_by = p_staff, reviewed_at = now(),
      review_note = nullif(left(p_note, 500), '') where id = r.id;
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_action <> 'approve' or p_role not in ('viewer','operator','auditor','admin')
     or p_location is null or p_location !~ '^[a-zA-Z0-9_-]{2,40}$' then
    raise exception 'Pilih lokasi dan peran yang valid' using errcode = '22023';
  end if;
  insert into ae_members(user_id, location_id, role) values (r.user_id, p_location, p_role)
  on conflict (user_id, location_id) do update set role = excluded.role;
  update ae_role_requests set status = 'approved', location_id = p_location, granted_role = p_role,
    reviewed_by = p_staff, reviewed_at = now(), review_note = nullif(left(p_note, 500), '') where id = r.id;
  return jsonb_build_object('status', 'approved', 'location_id', p_location, 'role', p_role);
end $$;
revoke all on function public.ae_review_role_request(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ae_review_role_request(uuid, uuid, text, text, text, text) to service_role;

commit;
