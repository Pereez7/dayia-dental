-- Contract support for the Configuracion Supabase migration.
-- RLS is enabled in 001 and clinic-scoped policies already live in 002.

create unique index if not exists business_hours_clinic_id_weekday_unique_idx
  on public.business_hours (clinic_id, weekday);

create index if not exists business_hours_clinic_id_weekday_idx
  on public.business_hours (clinic_id, weekday);

comment on table public.treatments is
  'Clinic-scoped treatments used by Nueva Cita and Agenda availability.';

comment on table public.business_hours is
  'Clinic-scoped weekly office hours and appointment interval settings.';

comment on table public.calendar_exceptions is
  'Clinic-scoped closed days or special-hours exceptions for Agenda availability.';
