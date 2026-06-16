-- Contract support for the Citas/Agenda Supabase migration.
-- The base tables and clinic-scoped RLS policies already live in 001/002.

create index if not exists appointment_change_logs_clinic_id_appointment_id_idx
  on public.appointment_change_logs (clinic_id, appointment_id);

comment on table public.appointments is
  'Clinic-scoped appointments for Agenda. Frontend real mode must always filter by clinic_id.';

comment on column public.appointments.reason is
  'Temporary frontend treatment/reason label until the treatments module is migrated to Supabase.';

comment on table public.appointment_change_logs is
  'Clinic-scoped audit trail for appointment creation, confirmation, cancellation and rescheduling.';
