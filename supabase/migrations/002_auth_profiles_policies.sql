-- DayIA Dental Auth and clinic-scoped RLS foundation.
-- This migration keeps clinical data private and scoped by profiles.clinic_id.
-- It assumes users are created through Supabase Auth and linked manually or by
-- a trusted backend process to public.profiles.

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.clinic_id
  from public.profiles
  where profiles.id = auth.uid()
$$;

revoke all on function public.current_clinic_id() from public;
grant execute on function public.current_clinic_id() to authenticated;

-- Profiles are intentionally not insertable by anonymous or arbitrary
-- authenticated clients in this migration. The initial MVP should create
-- profiles through a trusted setup process, SQL console, or a future admin flow.

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "clinic members can read own clinic" on public.clinics;
create policy "clinic members can read own clinic"
on public.clinics
for select
to authenticated
using (id = public.current_clinic_id());

drop policy if exists "clinic members can manage patients" on public.patients;
create policy "clinic members can manage patients"
on public.patients
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage treatments" on public.treatments;
create policy "clinic members can manage treatments"
on public.treatments
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage business hours" on public.business_hours;
create policy "clinic members can manage business hours"
on public.business_hours
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage calendar exceptions" on public.calendar_exceptions;
create policy "clinic members can manage calendar exceptions"
on public.calendar_exceptions
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage appointments" on public.appointments;
create policy "clinic members can manage appointments"
on public.appointments
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage appointment change logs" on public.appointment_change_logs;
create policy "clinic members can manage appointment change logs"
on public.appointment_change_logs
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage reminders" on public.reminders;
create policy "clinic members can manage reminders"
on public.reminders
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members can manage whatsapp settings" on public.whatsapp_settings;
create policy "clinic members can manage whatsapp settings"
on public.whatsapp_settings
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());
