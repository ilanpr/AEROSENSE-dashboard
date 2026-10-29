-- Apply before deploying the guest monitoring API. Existing nodes stay private.
alter table public.ae_nodes add column if not exists public_read boolean not null default false;
comment on column public.ae_nodes.public_read is 'Operator opt-in: publishes node coordinates, sensor history and regional context through the read-only backend API.';

-- Publish only the actual nodes intended for the public dashboard, for example:
-- update public.ae_nodes set public_read = true where id in ('node-01', 'node-02');
-- Revoke publication with public_read = false. Existing member RLS stays unchanged.
