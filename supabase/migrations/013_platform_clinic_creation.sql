-- Safe platform clinic creation prerequisites.
-- No clinical rows or data are created by this migration.

alter table public.clinic_memberships
  drop constraint if exists clinic_memberships_status_allowed;

alter table public.clinic_memberships
  add constraint clinic_memberships_status_allowed check (
    status in ('pending', 'pending_activation', 'active', 'inactive')
  );

create unique index if not exists clinics_normalized_name_unique_idx
  on public.clinics (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  );

comment on index public.clinics_normalized_name_unique_idx is
  'Prevents duplicate platform clinics after trimming, whitespace collapsing and case normalization.';

grant select, insert, delete on public.clinics to service_role;
grant select, insert, update on public.profiles to service_role;
grant select, insert, update on public.clinic_memberships to service_role;
grant select, insert, update on public.clinic_subscriptions to service_role;
grant select on public.plans to service_role;
