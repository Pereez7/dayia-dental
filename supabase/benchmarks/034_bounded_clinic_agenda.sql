-- Reproducible local benchmark for PERF-005B1.
--
-- Run with:
--   npx supabase test db supabase/benchmarks/034_bounded_clinic_agenda.sql
--
-- The 20,000 fictitious appointments and logs are rolled back.

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

select plan(3);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '34500000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@perf005b-benchmark.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.clinics (id, name, status)
values (
  '34500000-0000-4000-8000-000000000101',
  'PERF-005B Benchmark Clinic',
  'active'
);

insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  '34500000-0000-4000-8000-000000000001',
  'Owner PERF-005B Benchmark',
  'owner@perf005b-benchmark.test',
  false
);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values (
  '34500000-0000-4000-8000-000000000101',
  '34500000-0000-4000-8000-000000000001',
  'clinic_owner', 'active', now()
);

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values (
  '34500000-0000-4000-8000-000000000101',
  'pro', 'lifetime', now(), true
);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone
)
select
  gen_random_uuid(),
  '34500000-0000-4000-8000-000000000101',
  'Paciente',
  sequence_number::text,
  format('+5917%s', lpad(sequence_number::text, 7, '0'))
from generate_series(1, 1000) sequence_number;

insert into public.appointments (
  id, clinic_id, patient_id, appointment_date, start_time,
  duration_minutes, status, reason
)
select
  gen_random_uuid(),
  patients.clinic_id,
  patients.id,
  '2026-01-01'::date + ((occurrence * 37 + patient_number) % 365),
  '08:00'::time + make_interval(mins => ((patient_number % 40) * 15)),
  15,
  case (patient_number + occurrence) % 6
    when 0 then 'cancelled'
    when 1 then 'completed'
    when 2 then 'confirmed'
    when 3 then 'pending'
    when 4 then 'rescheduled'
    else 'no_show'
  end,
  'Control ficticio'
from (
  select
    patients.*,
    row_number() over (order by patients.id)::integer as patient_number
  from public.patients patients
  where patients.clinic_id = '34500000-0000-4000-8000-000000000101'
) patients
cross join generate_series(1, 20) occurrence;

insert into public.appointment_change_logs (
  clinic_id, appointment_id, type, description, created_at
)
select
  appointments.clinic_id,
  appointments.id,
  case
    when appointments.status = 'cancelled' then 'cancelled'
    when appointments.status = 'rescheduled' then 'rescheduled'
    when appointments.status = 'confirmed' then 'confirmed'
    else 'created'
  end,
  'Evento ficticio.',
  appointments.appointment_date::timestamp at time zone 'America/La_Paz'
from public.appointments appointments
where appointments.clinic_id = '34500000-0000-4000-8000-000000000101';

insert into public.appointment_change_logs (
  clinic_id, appointment_id, type, description, created_at
)
select
  target_appointment.clinic_id,
  target_appointment.id,
  'confirmed',
  'Evento histórico ficticio.',
  '2026-01-01 12:00:00+00'::timestamptz
    + make_interval(secs => sequence_number)
from (
  select appointments.id, appointments.clinic_id
  from public.appointments appointments
  where appointments.clinic_id =
    '34500000-0000-4000-8000-000000000101'::uuid
  order by appointments.id
  limit 1
) target_appointment
cross join generate_series(1, 200) sequence_number;

analyze public.appointments;
analyze public.appointment_change_logs;

create temporary table perf005b_plans (
  label text primary key,
  query_plan jsonb not null
) on commit drop;

do $capture_plans$
declare
  captured_plan json;
begin
  execute $explain$
    explain (analyze, buffers, format json)
    select appointments.id
    from public.appointments appointments
    where appointments.clinic_id =
      '34500000-0000-4000-8000-000000000101'::uuid
      and appointments.appointment_date = '2026-08-05'::date
    order by appointments.start_time, appointments.id
    limit 21
  $explain$ into captured_plan;
  insert into perf005b_plans values ('page', captured_plan::jsonb);

  execute $explain$
    explain (analyze, buffers, format json)
    select logs.id
    from public.appointment_change_logs logs
    where logs.clinic_id =
      '34500000-0000-4000-8000-000000000101'::uuid
      and logs.appointment_id = (
        select appointments.id
        from public.appointments appointments
        where appointments.clinic_id =
          '34500000-0000-4000-8000-000000000101'::uuid
        order by appointments.id
        limit 1
      )
    order by logs.created_at desc, logs.id desc
    limit 1
  $explain$ into captured_plan;
  insert into perf005b_plans values ('latest_log', captured_plan::jsonb);
end;
$capture_plans$;

select ok(
  (
    select query_plan::text like '%appointments_clinic_day_schedule_idx%'
    from perf005b_plans
    where label = 'page'
  ),
  'the selected day page uses the stable schedule index'
);

select ok(
  (
    select
      query_plan::text like '%appointment_change_logs_appointment_recent_idx%'
    from perf005b_plans
    where label = 'latest_log'
  ),
  'the latest audit lookup uses its ordered appointment index'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"34500000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@perf005b-benchmark.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '34500000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select performs_ok(
  $$
    select public.get_clinic_agenda_snapshot(
      '34500000-0000-4000-8000-000000000101',
      '2026-08-05', '2026-08-05', 20, null, null
    )
  $$,
  1500,
  'the bounded agenda stays within the local read budget at fictitious scale'
);

select * from finish();
rollback;
