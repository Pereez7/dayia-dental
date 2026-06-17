-- Normalize profile roles for the MVP auth/session model.
-- This keeps legacy setup values working while the app moves to explicit roles.

update public.profiles
set role = case
  when role in ('admin', 'owner', 'clinic_admin') then 'clinic_admin'
  when role in ('dentist', 'doctor') then 'doctor'
  when role in ('reception', 'receptionist') then 'receptionist'
  when role = 'super_admin' then 'super_admin'
  when role is null then 'clinic_admin'
  else 'clinic_admin'
end;

alter table public.profiles
drop constraint if exists profiles_role_allowed;

alter table public.profiles
add constraint profiles_role_allowed
check (role in ('super_admin', 'clinic_admin', 'doctor', 'receptionist'));

comment on column public.profiles.role is
  'MVP user role: super_admin, clinic_admin, doctor, or receptionist. Legacy admin/owner values are normalized to clinic_admin.';
