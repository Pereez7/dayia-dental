-- User management MVP fields and same-clinic profile visibility.
-- No secrets or credentials are stored here. User creation is handled by Edge Function.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;

update public.profiles
set is_active = true
where is_active is null;

create index if not exists profiles_clinic_full_name_idx
  on public.profiles (clinic_id, full_name);

create index if not exists profiles_clinic_email_idx
  on public.profiles (clinic_id, lower(email))
  where email is not null;

grant select on public.profiles to authenticated;

comment on column public.profiles.email is
  'Contact email for clinic user listings. Auth remains the credential source.';

comment on column public.profiles.is_active is
  'Operational status for clinic users. Auth still controls login access.';

drop policy if exists "clinic members can read clinic profiles" on public.profiles;
drop policy if exists "profiles_select_same_clinic" on public.profiles;

create policy "profiles_select_same_clinic"
  on public.profiles
  for select
  to authenticated
  using (clinic_id = public.current_clinic_id());

comment on policy "profiles_select_same_clinic" on public.profiles is
  'Allows authenticated users to see non-secret profiles from their own clinic only.';

-- Existing owner profiles can be backfilled after setup with a targeted update:
-- update public.profiles
-- set email = 'owner@example.com'
-- where id = 'auth-user-uuid' and clinic_id = 'clinic-uuid';
