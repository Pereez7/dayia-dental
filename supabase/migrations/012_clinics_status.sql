-- Administrative lifecycle status for platform clinic listings.
-- Existing rows remain null so the Edge Function can apply a controlled fallback.

alter table public.clinics
  add column if not exists status text;

alter table public.clinics
  drop constraint if exists clinics_status_allowed;

alter table public.clinics
  add constraint clinics_status_allowed check (
    status is null
    or status in ('active', 'pending_activation', 'suspended')
  );

comment on column public.clinics.status is
  'Administrative lifecycle status. Null legacy rows use the subscription fallback in list-platform-clinics.';
