-- Reproducible local benchmark for PERF-005B2.
--
-- Run with:
--   npx supabase test db supabase/benchmarks/035_atomic_appointment_scheduling.sql
--
-- The 20,000 fictitious appointments are rolled back.

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

select plan(4);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '35500000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@perf005b2-benchmark.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.clinics (id, name, status)
values (
  '35500000-0000-4000-8000-000000000101',
  'PERF-005B2 Benchmark Clinic',
  'active'
);

insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  '35500000-0000-4000-8000-000000000001',
  'Owner PERF-005B2 Benchmark',
  'owner@perf005b2-benchmark.test',
  false
);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values (
  '35500000-0000-4000-8000-000000000101',
  '35500000-0000-4000-8000-000000000001',
  'clinic_owner', 'active', now()
);

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values (
  '35500000-0000-4000-8000-000000000101',
  'pro', 'lifetime', now(), true
);

insert into public.business_hours (
  clinic_id, weekday, is_open, start_time, end_time, slot_interval_minutes
)
select
  '35500000-0000-4000-8000-000000000101',
  weekday,
  true,
  '08:00',
  '18:00',
  30
from generate_series(0, 6) weekday;

insert into public.treatments (
  id, clinic_id, name, duration_minutes, is_active
)
values (
  '35500000-0000-4000-a000-000000000001',
  '35500000-0000-4000-8000-000000000101',
  'Control benchmark', 30, true
);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone
)
select
  gen_random_uuid(),
  '35500000-0000-4000-8000-000000000101',
  'Paciente',
  sequence_number::text,
  format('+5917%s', lpad(sequence_number::text, 7, '0'))
from generate_series(1, 1000) sequence_number;

insert into public.patients (
  id, clinic_id, first_name, last_name, phone
)
values (
  '35500000-0000-4000-9000-000000009999',
  '35500000-0000-4000-8000-000000000101',
  'Paciente', 'Objetivo', '+59179999999'
);

insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
select
  gen_random_uuid(),
  patients.clinic_id,
  patients.id,
  '35500000-0000-4000-a000-000000000001',
  '2026-01-01'::date + ((occurrence * 37 + patient_number) % 365),
  '08:00'::time + make_interval(mins => ((patient_number % 20) * 30)),
  30,
  case (patient_number + occurrence) % 5
    when 0 then 'cancelled'
    when 1 then 'completed'
    when 2 then 'confirmed'
    when 3 then 'pending'
    else 'rescheduled'
  end,
  'Control ficticio'
from (
  select
    patients.*,
    row_number() over (order by patients.id)::integer as patient_number
  from public.patients patients
  where patients.clinic_id = '35500000-0000-4000-8000-000000000101'
    and patients.id <> '35500000-0000-4000-9000-000000009999'
) patients
cross join generate_series(1, 20) occurrence;

analyze public.appointments;

create temporary table perf005b2_plans (
  label text primary key,
  query_plan jsonb not null
) on commit drop;

do $capture_plans$
declare
  captured_plan json;
  sample_patient_id uuid;
begin
  select appointments.patient_id
  into sample_patient_id
  from public.appointments appointments
  where appointments.clinic_id =
    '35500000-0000-4000-8000-000000000101'
    and appointments.status in ('pending', 'confirmed', 'rescheduled')
  limit 1;

  execute format(
    $explain$
      explain (analyze, buffers, format json)
      select appointments.id
      from public.appointments appointments
      where appointments.clinic_id =
        '35500000-0000-4000-8000-000000000101'::uuid
        and appointments.patient_id = %L::uuid
        and appointments.appointment_date = '2026-08-05'::date
        and appointments.status in ('pending', 'confirmed', 'rescheduled')
    $explain$,
    sample_patient_id
  ) into captured_plan;
  insert into perf005b2_plans values ('patient_day', captured_plan::jsonb);

  execute $explain$
    explain (analyze, buffers, format json)
    select appointments.id
    from public.appointments appointments
    where appointments.clinic_id =
      '35500000-0000-4000-8000-000000000101'::uuid
      and appointments.appointment_date = '2026-08-05'::date
      and appointments.status in ('pending', 'confirmed', 'rescheduled')
      and appointments.start_time < '10:30'::time
      and appointments.start_time
        + make_interval(mins => appointments.duration_minutes) > '10:00'::time
  $explain$ into captured_plan;
  insert into perf005b2_plans values ('overlap', captured_plan::jsonb);
end;
$capture_plans$;

select ok(
  (
    select query_plan::text like '%appointments_active_patient_day_idx%'
    from perf005b2_plans
    where label = 'patient_day'
  ),
  'the patient-day guard uses its partial active index'
);

select ok(
  (
    select query_plan::text like '%appointments_active_clinic_day_time_idx%'
    from perf005b2_plans
    where label = 'overlap'
  ),
  'the overlap guard uses its partial active schedule index'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"35500000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@perf005b2-benchmark.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '35500000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select performs_ok(
  $$
    select public.create_clinic_appointment(
      '35500000-0000-4000-8000-000000000101',
      '35500000-0000-4000-9000-000000009999',
      '35500000-0000-4000-a000-000000000001',
      '2099-12-31', '09:00', 'pending'
    )
  $$,
  1500,
  'atomic creation stays within the local write budget at fictitious scale'
);

select performs_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35500000-0000-4000-8000-000000000101',
      (
        select appointments.id
        from public.appointments appointments
        where appointments.patient_id =
          '35500000-0000-4000-9000-000000009999'
      ),
      '2099-12-31', '09:00',
      '2099-12-30', '09:00', 'Cambio benchmark'
    )
  $$,
  1500,
  'atomic rescheduling stays within the local write budget at fictitious scale'
);

select * from finish();
rollback;
