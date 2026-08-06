-- Reproducible local benchmark for PERF-005D.
--
-- Run with:
--   npx supabase test db supabase/benchmarks/037_bounded_clinical_history.sql
--
-- The 2,000 patients and 20,000 clinical records are rolled back.

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

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '37500000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner@perf005d-benchmark.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.clinics (id, name, status)
values (
  '37500000-0000-4000-8000-000000000101',
  'PERF-005D Benchmark Clinic',
  'active'
);

insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  '37500000-0000-4000-8000-000000000001',
  'Owner PERF-005D Benchmark',
  'owner@perf005d-benchmark.test',
  false
);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values (
  '37500000-0000-4000-8000-000000000101',
  '37500000-0000-4000-8000-000000000001',
  'clinic_owner', 'active', now()
);

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values (
  '37500000-0000-4000-8000-000000000101',
  'pro', 'lifetime', now(), true
);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email, created_at
)
select
  gen_random_uuid(),
  '37500000-0000-4000-8000-000000000101',
  'Paciente',
  'Historia ' || sequence_number,
  '+5916' || lpad(sequence_number::text, 7, '0'),
  'perf005d-' || sequence_number || '@example.test',
  '2026-08-05 12:00:00+00'::timestamptz
    - make_interval(secs => sequence_number)
from generate_series(1, 2000) sequence_number;

insert into public.clinical_records (
  clinic_id, patient_id, created_by, record_date, reason, diagnosis,
  treatment, observations
)
select
  patients.clinic_id,
  patients.id,
  '37500000-0000-4000-8000-000000000001',
  '2026-08-05 12:00:00+00'::timestamptz
    - make_interval(days => occurrence, secs => patient_number),
  'Control preventivo',
  case when occurrence % 2 = 0 then 'Gingivitis' else 'Paciente sano' end,
  'Profilaxis',
  format('Hallazgo %s %s', patient_number, occurrence)
from (
  select
    patients.*,
    row_number() over (order by patients.created_at desc)::integer
      as patient_number
  from public.patients patients
  where patients.clinic_id =
    '37500000-0000-4000-8000-000000000101'::uuid
) patients
cross join generate_series(1, 10) occurrence;

analyze public.patients;
analyze public.clinical_records;

create temporary table perf005d_plans (
  label text primary key,
  query_plan jsonb not null
) on commit drop;

do $capture_plans$
declare
  captured_plan json;
  sample_patient_id uuid;
begin
  select patients.id
  into sample_patient_id
  from public.patients patients
  where patients.clinic_id =
    '37500000-0000-4000-8000-000000000101'::uuid
  order by patients.created_at desc
  limit 1;

  execute format(
    $explain$
      explain (analyze, buffers, format json)
      select records.id
      from public.clinical_records records
      where records.clinic_id =
        '37500000-0000-4000-8000-000000000101'::uuid
        and records.patient_id = %L::uuid
      order by records.record_date desc, records.id desc
      limit 9
    $explain$,
    sample_patient_id
  ) into captured_plan;
  insert into perf005d_plans values ('patient_page', captured_plan::jsonb);

  execute $explain$
    explain (analyze, buffers, format json)
    select records.id
    from public.clinical_records records
    where records.clinic_id =
      '37500000-0000-4000-8000-000000000101'::uuid
    order by records.record_date desc, records.id desc
    limit 9
  $explain$ into captured_plan;
  insert into perf005d_plans values ('global_cursor', captured_plan::jsonb);

  execute $explain$
    explain (analyze, buffers, format json)
    select records.id
    from public.clinical_records records
    where records.clinic_id =
      '37500000-0000-4000-8000-000000000101'::uuid
      and public.normalize_clinical_record_search(
        records.reason || ' ' || records.diagnosis || ' ' ||
        records.treatment || ' ' || coalesce(records.observations, '')
      ) like '%hallazgo 1999 10%'
    limit 9
  $explain$ into captured_plan;
  insert into perf005d_plans values ('clinical_search', captured_plan::jsonb);
end;
$capture_plans$;

select ok(
  (
    select query_plan::text like
      '%clinical_records_clinic_patient_record_cursor_idx%'
    from perf005d_plans
    where label = 'patient_page'
  ),
  'the patient page uses its stable clinic and patient cursor index'
);

select ok(
  (
    select query_plan::text like '%clinical_records_clinic_record_cursor_idx%'
    from perf005d_plans
    where label = 'global_cursor'
  ),
  'the global recent-record path uses its ordered clinic cursor index'
);

select ok(
  (
    select query_plan::text like '%clinical_records_search_trgm_idx%'
    from perf005d_plans
    where label = 'clinical_search'
  ),
  'normalized clinical search uses its trigram index'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"37500000-0000-4000-8000-000000000001","role":"authenticated","email":"owner@perf005d-benchmark.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '37500000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select performs_ok(
  $$
    select public.get_patient_clinical_records_page(
      '37500000-0000-4000-8000-000000000101',
      (
        select patients.id
        from public.patients patients
        where patients.clinic_id =
          '37500000-0000-4000-8000-000000000101'::uuid
        order by patients.created_at desc
        limit 1
      ),
      null, null, 8
    )
  $$,
  1500,
  'the bounded patient history page stays within the local read budget'
);

select performs_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37500000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )
  $$,
  1500,
  'the bounded global history page stays within the local read budget'
);

select performs_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37500000-0000-4000-8000-000000000101', 'hallazgo 1999 10', 'all',
      '2026-08-05', null, null, 8
    )
  $$,
  1500,
  'clinical-content search stays within the local read budget'
);

select * from finish();
rollback;
