begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;

do $setup_pgtap_search_path$
declare
  pgtap_schema text;
begin
  select namespaces.nspname
  into pgtap_schema
  from pg_proc procedures
  join pg_namespace namespaces on namespaces.oid = procedures.pronamespace
  where procedures.proname = 'plan'
    and pg_get_function_identity_arguments(procedures.oid) = 'integer'
  order by namespaces.nspname
  limit 1;

  perform set_config(
    'search_path',
    format('public, extensions, %I', pgtap_schema),
    false
  );
end;
$setup_pgtap_search_path$;

select plan(17);

select has_function(
  'public', 'sync_appointment_reminders_after_write', array[]::text[],
  'the appointment reminder synchronization trigger function exists'
);

select has_trigger(
  'public', 'appointments', 'sync_appointment_reminders_after_write',
  'appointments synchronize reminders after server writes'
);

select function_privs_are(
  'public', 'sync_appointment_reminders_after_write', array[]::text[],
  'authenticated', array[]::text[],
  'the internal trigger function cannot be called by the frontend'
);

select is(
  (
    select count(*)::integer
    from public.appointments appointments
    where appointments.treatment_id is not null
      and appointments.status in ('pending', 'confirmed', 'rescheduled')
      and appointments.appointment_date + appointments.start_time
        > timezone('America/La_Paz', now())
      and not exists (
        select 1
        from public.reminders reminders
        where reminders.clinic_id = appointments.clinic_id
          and reminders.appointment_id = appointments.id
      )
  ),
  0,
  'no real active future appointment remains without a reminder'
);

insert into public.clinics (id, name, status)
values ('39000000-0000-4000-8000-000000000101', 'PERF-005E Atomic Clinic', 'active');

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email
)
values
  (
    '39000000-0000-4000-9000-000000000001',
    '39000000-0000-4000-8000-000000000101',
    'Lucía', 'Flores', '+59170000391', 'lucia@perf005e-atomic.test'
  ),
  (
    '39000000-0000-4000-9000-000000000002',
    '39000000-0000-4000-8000-000000000101',
    'Sin', 'Teléfono', '', 'no-phone@perf005e-atomic.test'
  );

insert into public.treatments (
  id, clinic_id, name, duration_minutes, is_active
)
values (
  '39000000-0000-4000-9100-000000000001',
  '39000000-0000-4000-8000-000000000101',
  'Control preventivo', 30, true
);

insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
values (
  '39000000-0000-4000-9200-000000000001',
  '39000000-0000-4000-8000-000000000101',
  '39000000-0000-4000-9000-000000000001',
  '39000000-0000-4000-9100-000000000001',
  '2099-08-20', '10:00', 30, 'pending', 'Control preventivo'
);

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'),
  2,
  'a future appointment creates both reminders in the same transaction'
);

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'
     and reminder_type = '24h' and status = 'scheduled'),
  1,
  'the 24-hour reminder starts scheduled'
);

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'
     and reminder_type = '2h' and status = 'pending'),
  1,
  'the 2-hour reminder starts pending'
);

select ok(
  (select bool_and(message like 'Hola Lucía,%') from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'),
  'messages use the patient data read by PostgreSQL'
);

update public.appointments
set status = 'confirmed'
where id = '39000000-0000-4000-9200-000000000001';

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'),
  2,
  'confirming an appointment does not duplicate its reminders'
);

select ok(
  (select bool_and(message like '%cita odontológica confirmada%')
   from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'),
  'confirming an appointment refreshes its active messages'
);

update public.appointments
set appointment_date = '2099-08-21', status = 'rescheduled'
where id = '39000000-0000-4000-9200-000000000001';

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'
     and status = 'cancelled'),
  2,
  'rescheduling preserves the previous reminder occurrence as cancelled'
);

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'
     and status in ('pending', 'scheduled')),
  2,
  'rescheduling creates a fresh active reminder pair'
);

update public.appointments
set status = 'cancelled'
where id = '39000000-0000-4000-9200-000000000001';

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000001'
     and status in ('pending', 'scheduled')),
  0,
  'a terminal appointment leaves no mutable reminder active'
);

insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
values (
  '39000000-0000-4000-9200-000000000002',
  '39000000-0000-4000-8000-000000000101',
  '39000000-0000-4000-9000-000000000002',
  '39000000-0000-4000-9100-000000000001',
  '2099-08-22', '10:00', 30, 'pending', 'Control preventivo'
);

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000002'
     and status = 'skipped'),
  2,
  'an appointment without a phone keeps traceable skipped reminders'
);

with near_slot as (
  select timezone('America/La_Paz', now()) + interval '1 hour' as starts_at
)
insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
select
  '39000000-0000-4000-9200-000000000003',
  '39000000-0000-4000-8000-000000000101',
  '39000000-0000-4000-9000-000000000001',
  '39000000-0000-4000-9100-000000000001',
  near_slot.starts_at::date,
  near_slot.starts_at::time,
  30,
  'pending',
  'Control preventivo'
from near_slot;

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000003'
     and reminder_type = 'immediate' and status = 'pending'),
  1,
  'a nearby future appointment creates one immediate reminder'
);

alter table public.appointments
  disable trigger sync_appointment_reminders_after_write;

insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
values (
  '39000000-0000-4000-9200-000000000004',
  '39000000-0000-4000-8000-000000000101',
  '39000000-0000-4000-9000-000000000001',
  '39000000-0000-4000-9100-000000000001',
  '2099-08-23', '10:00', 30, 'pending', 'Control preventivo'
);

alter table public.appointments
  enable trigger sync_appointment_reminders_after_write;

update public.appointments
set status = status
where id = '39000000-0000-4000-9200-000000000004';

select is(
  (select count(*)::integer from public.reminders
   where appointment_id = '39000000-0000-4000-9200-000000000004'),
  2,
  'an active appointment without reminders is repaired idempotently'
);

select ok(
  not exists (
    select 1
    from public.reminders reminders
    join public.appointments appointments
      on appointments.id = reminders.appointment_id
    where reminders.clinic_id <> appointments.clinic_id
      or reminders.patient_id <> appointments.patient_id
  ),
  'generated reminders preserve clinic and patient isolation'
);

select * from finish();
rollback;
