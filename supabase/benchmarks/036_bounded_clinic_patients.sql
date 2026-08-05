-- Reproducible local benchmark for PERF-005C.
--
-- Run with:
--   npx supabase test db supabase/benchmarks/036_bounded_clinic_patients.sql
--
-- The 20,000 fictitious patients and appointments are rolled back.

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
  '36500000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@perf005c-benchmark.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.clinics (id, name, status)
values (
  '36500000-0000-4000-8000-000000000101',
  'PERF-005C Benchmark Clinic',
  'active'
);

insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  '36500000-0000-4000-8000-000000000001',
  'Owner PERF-005C Benchmark',
  'owner@perf005c-benchmark.test',
  false
);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values (
  '36500000-0000-4000-8000-000000000101',
  '36500000-0000-4000-8000-000000000001',
  'clinic_owner', 'active', now()
);

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values (
  '36500000-0000-4000-8000-000000000101',
  'pro', 'lifetime', now(), true
);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email, created_at
)
select
  gen_random_uuid(),
  '36500000-0000-4000-8000-000000000101',
  'Paciente',
  'Carga ' || sequence_number,
  '+5917' || lpad(sequence_number::text, 7, '0'),
  'perf005c-' || sequence_number || '@example.test',
  '2026-08-05 12:00:00+00'::timestamptz
    - make_interval(secs => sequence_number)
from generate_series(1, 20000) sequence_number;

insert into public.appointments (
  clinic_id, patient_id, appointment_date, start_time, duration_minutes,
  status, reason
)
select
  patients.clinic_id,
  patients.id,
  '2026-01-01'::date + (patient_number % 365),
  '09:00'::time,
  30,
  case when patient_number % 2 = 0 then 'completed' else 'confirmed' end,
  'Control ficticio'
from (
  select
    patients.*,
    row_number() over (order by patients.created_at desc)::integer
      as patient_number
  from public.patients patients
  where patients.clinic_id =
    '36500000-0000-4000-8000-000000000101'::uuid
) patients;

analyze public.patients;
analyze public.appointments;

create temporary table perf005c_plans (
  label text primary key,
  query_plan jsonb not null
) on commit drop;

do $capture_plans$
declare
  captured_plan json;
begin
  execute $explain$
    explain (analyze, buffers, format json)
    select patients.id
    from public.patients patients
    where patients.clinic_id =
      '36500000-0000-4000-8000-000000000101'::uuid
    order by patients.created_at desc, patients.id desc
    limit 13
  $explain$ into captured_plan;
  insert into perf005c_plans values ('page', captured_plan::jsonb);

  execute $explain$
    explain (analyze, buffers, format json)
    select patients.id
    from public.patients patients
    where patients.clinic_id =
      '36500000-0000-4000-8000-000000000101'::uuid
      and public.normalize_patient_search(
        patients.first_name || ' ' ||
        patients.last_name || ' ' ||
        patients.phone || ' ' ||
        coalesce(patients.email, '')
      ) like '%perf005c 19999%'
    order by patients.created_at desc, patients.id desc
    limit 13
  $explain$ into captured_plan;
  insert into perf005c_plans values ('search', captured_plan::jsonb);
end;
$capture_plans$;

select ok(
  (
    select query_plan::text like '%patients_clinic_created_idx%'
    from perf005c_plans
    where label = 'page'
  ),
  'the recent patient page uses its ordered clinic index'
);

select ok(
  (
    select query_plan::text like '%patients_search_trgm_idx%'
    from perf005c_plans
    where label = 'search'
  ),
  'normalized patient search uses its trigram index'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"36500000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@perf005c-benchmark.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '36500000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select performs_ok(
  $$
    select public.get_clinic_patients_page(
      '36500000-0000-4000-8000-000000000101', '', '2026-08-05',
      null, null, 12
    )
  $$,
  1500,
  'the bounded patient page stays within the local read budget'
);

select performs_ok(
  $$
    select public.get_clinic_patients_page(
      '36500000-0000-4000-8000-000000000101', 'perf005c-19999',
      '2026-08-05', null, null, 12
    )
  $$,
  1500,
  'normalized search stays within the local read budget'
);

select * from finish();
rollback;
