-- Patients module migration support.
--
-- Pacientes is the first app module connected to Supabase in real mode.
-- All frontend queries must keep filtering by clinic_id, and RLS policies from
-- 002_auth_profiles_policies.sql remain the security boundary.
-- Demo/development mode keeps using local mock patients and must not seed or
-- write mock patients into Supabase automatically.

create index if not exists patients_clinic_id_last_name_idx
  on public.patients (clinic_id, last_name);

comment on table public.patients is
  'Clinic-scoped patient records used by the Pacientes module in real Supabase mode.';

comment on column public.patients.clinic_id is
  'Tenant boundary. Every patient query and mutation must be scoped by clinic_id.';
