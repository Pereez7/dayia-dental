-- User management MVP fields and same-clinic profile visibility.
-- No secrets or credentials are stored here.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;

update public.profiles
set is_active = true
where is_active is null;

create index if not exists profiles_clinic_full_name_idx
  on public.profiles (clinic_id, full_name);

comment on column public.profiles.email is
  'Public contact email for clinic user listings. Auth remains the source of credentials.';

comment on column public.profiles.is_active is
  'Operational user status for clinic user management MVP.';

drop policy if exists "clinic members can read clinic profiles" on public.profiles;

create policy "clinic members can read clinic profiles"
  on public.profiles
  for select
  to authenticated
  using (clinic_id = public.current_clinic_id());

comment on policy "clinic members can read clinic profiles" on public.profiles is
  'Allows authenticated users to see non-secret profiles from their own clinic only.';
