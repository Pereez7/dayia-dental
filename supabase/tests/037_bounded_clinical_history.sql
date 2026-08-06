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

select plan(40);

select has_function(
  'public',
  'get_patient_clinical_records_page',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid', 'integer'],
  'the bounded patient clinical-history RPC exists'
);

select has_function(
  'public',
  'get_clinic_clinical_history_page',
  array[
    'uuid', 'text', 'text', 'date', 'timestamp with time zone', 'uuid',
    'integer'
  ],
  'the bounded global clinical-history RPC exists'
);

select has_index(
  'public', 'clinical_records', 'clinical_records_clinic_record_cursor_idx',
  'global history has a stable cursor index'
);

select has_index(
  'public', 'clinical_records',
  'clinical_records_clinic_patient_record_cursor_idx',
  'patient history has a stable cursor index'
);

select has_index(
  'public', 'clinical_records', 'clinical_records_search_trgm_idx',
  'clinical content search has a trigram index'
);

select function_privs_are(
  'public',
  'get_patient_clinical_records_page',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid', 'integer'],
  'anon',
  array[]::text[],
  'anonymous users cannot read a patient clinical history'
);

select function_privs_are(
  'public',
  'get_clinic_clinical_history_page',
  array[
    'uuid', 'text', 'text', 'date', 'timestamp with time zone', 'uuid',
    'integer'
  ],
  'anon',
  array[]::text[],
  'anonymous users cannot read global clinical history'
);

select function_privs_are(
  'public',
  'get_patient_clinical_records_page',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid', 'integer'],
  'authenticated',
  array['EXECUTE'],
  'authorized clinical users can call patient history'
);

select function_privs_are(
  'public',
  'get_clinic_clinical_history_page',
  array[
    'uuid', 'text', 'text', 'date', 'timestamp with time zone', 'uuid',
    'integer'
  ],
  'authenticated',
  array['EXECUTE'],
  'authorized clinical users can call global history'
);

select is(
  public.normalize_clinical_record_search(' Revisión   PERIODONTAL '),
  'revision periodontal',
  'clinical search is accent and whitespace insensitive'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '37000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner-a@perf005d.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '37000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'owner-b@perf005d.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '37000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'reception@perf005d.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.clinics (id, name, status)
values
  ('37000000-0000-4000-8000-000000000101', 'PERF-005D Clinic A', 'active'),
  ('37000000-0000-4000-8000-000000000102', 'PERF-005D Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  (
    '37000000-0000-4000-8000-000000000001',
    'Owner PERF-005D A', 'owner-a@perf005d.test', false
  ),
  (
    '37000000-0000-4000-8000-000000000002',
    'Owner PERF-005D B', 'owner-b@perf005d.test', false
  ),
  (
    '37000000-0000-4000-8000-000000000003',
    'Reception PERF-005D', 'reception@perf005d.test', false
  );

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values
  (
    '37000000-0000-4000-8000-000000000101',
    '37000000-0000-4000-8000-000000000001',
    'clinic_owner', 'active', now()
  ),
  (
    '37000000-0000-4000-8000-000000000102',
    '37000000-0000-4000-8000-000000000002',
    'clinic_owner', 'active', now()
  ),
  (
    '37000000-0000-4000-8000-000000000101',
    '37000000-0000-4000-8000-000000000003',
    'receptionist', 'active', now()
  );

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values
  (
    '37000000-0000-4000-8000-000000000101',
    'pro', 'lifetime', now(), true
  ),
  (
    '37000000-0000-4000-8000-000000000102',
    'pro', 'lifetime', now(), true
  );

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email, created_at
)
select
  ('37000000-0000-4000-9000-' || lpad(series.i::text, 12, '0'))::uuid,
  '37000000-0000-4000-8000-000000000101'::uuid,
  case when series.i = 1 then 'José' else 'Paciente' end,
  case when series.i = 1 then 'Álvarez' else 'Clínico ' || series.i end,
  '+5917100' || lpad(series.i::text, 4, '0'),
  'patient' || series.i || '@perf005d.test',
  '2026-08-05 10:00:00+00'::timestamptz - make_interval(mins => series.i)
from generate_series(1, 12) series(i);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email
)
values (
  '37000000-0000-4000-9000-000000000099',
  '37000000-0000-4000-8000-000000000102',
  'Paciente', 'Ajeno', '+59179990000', 'other@perf005d.test'
);

insert into public.clinical_records (
  id, clinic_id, patient_id, created_by, record_date, reason, diagnosis,
  treatment, observations
)
select
  ('37000000-0000-4000-9100-' || lpad((100 + series.i)::text, 12, '0'))::uuid,
  '37000000-0000-4000-8000-000000000101'::uuid,
  ('37000000-0000-4000-9000-' || lpad(series.i::text, 12, '0'))::uuid,
  '37000000-0000-4000-8000-000000000001'::uuid,
  '2026-08-05 12:00:00+00'::timestamptz - make_interval(mins => series.i),
  'Control general ' || series.i,
  'Diagnóstico preventivo ' || series.i,
  'Profilaxis ' || series.i,
  'Sin novedad ' || series.i
from generate_series(1, 12) series(i);

insert into public.clinical_records (
  id, clinic_id, patient_id, created_by, record_date, reason, diagnosis,
  treatment, observations
)
select
  ('37000000-0000-4000-9100-' || lpad((200 + series.i)::text, 12, '0'))::uuid,
  '37000000-0000-4000-8000-000000000101'::uuid,
  '37000000-0000-4000-9000-000000000001'::uuid,
  '37000000-0000-4000-8000-000000000001'::uuid,
  '2026-07-02 12:00:00+00'::timestamptz - make_interval(days => series.i),
  case when series.i = 1 then 'Revisión periodontal' else 'Control histórico' end,
  case when series.i = 1 then 'Gingivitis moderada' else 'Evolución favorable' end,
  'Seguimiento clínico',
  'Registro histórico ' || series.i
from generate_series(1, 9) series(i);

insert into public.clinical_records (
  id, clinic_id, patient_id, created_by, record_date, reason, diagnosis,
  treatment, observations
)
values (
  '37000000-0000-4000-9100-000000000999',
  '37000000-0000-4000-8000-000000000102',
  '37000000-0000-4000-9000-000000000099',
  '37000000-0000-4000-8000-000000000002',
  '2026-08-05 13:00:00+00',
  'Registro ajeno', 'Diagnóstico ajeno', 'Tratamiento ajeno', 'No exponer'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '37000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )->'records'
  ),
  8,
  'patient history respects its page size'
);

select is(
  (
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )->'pageInfo'->>'hasMore'
  )::boolean,
  true,
  'patient history reports more records'
);

select is(
  (
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )->'summary'->>'totalRecords'
  )::integer,
  10,
  'patient summary counts the complete history'
);

select is(
  left(
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )->'summary'->>'firstRecordDate',
    10
  ),
  '2026-06-23',
  'patient summary returns the first record date'
);

select is(
  left(
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )->'summary'->>'lastRecordDate',
    10
  ),
  '2026-08-05',
  'patient summary returns the latest record date'
);

with first_page as (
  select public.get_patient_clinical_records_page(
    '37000000-0000-4000-8000-000000000101',
    '37000000-0000-4000-9000-000000000001', null, null, 8
  ) as payload
)
select is(
  jsonb_array_length(
    public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001',
      (payload->'pageInfo'->'nextCursor'->>'recordDate')::timestamptz,
      (payload->'pageInfo'->'nextCursor'->>'id')::uuid,
      8
    )->'records'
  ),
  2,
  'the second patient page contains only the remaining records'
)
from first_page;

with first_page as (
  select public.get_patient_clinical_records_page(
    '37000000-0000-4000-8000-000000000101',
    '37000000-0000-4000-9000-000000000001', null, null, 8
  ) as payload
),
second_page as (
  select public.get_patient_clinical_records_page(
    '37000000-0000-4000-8000-000000000101',
    '37000000-0000-4000-9000-000000000001',
    (payload->'pageInfo'->'nextCursor'->>'recordDate')::timestamptz,
    (payload->'pageInfo'->'nextCursor'->>'id')::uuid,
    8
  ) as payload
  from first_page
)
select is(
  (
    select count(*)
    from jsonb_array_elements((select payload->'records' from first_page)) a
    join jsonb_array_elements((select payload->'records' from second_page)) b
      on a->>'id' = b->>'id'
  ),
  0::bigint,
  'patient cursor pages never repeat a record'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      public.get_patient_clinical_records_page(
        '37000000-0000-4000-8000-000000000101',
        '37000000-0000-4000-9000-000000000001', null, null, 8
      )->'records'
    ) records
    where records->>'patientId' <>
      '37000000-0000-4000-9000-000000000001'
  ),
  0::bigint,
  'patient history never includes another patient'
);

select is(
  jsonb_array_length(
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )->'groups'
  ),
  8,
  'global history respects its patient-group page size'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )->'pageInfo'->>'hasMore'
  )::boolean,
  true,
  'global history reports more patient groups'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )->'summary'->>'totalRecords'
  )::integer,
  21,
  'global summary counts all matching records'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )->'summary'->>'patientsWithHistory'
  )::integer,
  12,
  'global summary counts every matching patient'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )->'summary'->>'recordsThisMonth'
  )::integer,
  12,
  'global summary counts this month independently of pagination'
);

with first_page as (
  select public.get_clinic_clinical_history_page(
    '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
    null, null, 8
  ) as payload
)
select is(
  jsonb_array_length(
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      (payload->'pageInfo'->'nextCursor'->>'latestRecordDate')::timestamptz,
      (payload->'pageInfo'->'nextCursor'->>'patientId')::uuid,
      8
    )->'groups'
  ),
  4,
  'the second global page contains the remaining patient groups'
)
from first_page;

with first_page as (
  select public.get_clinic_clinical_history_page(
    '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
    null, null, 8
  ) as payload
),
second_page as (
  select public.get_clinic_clinical_history_page(
    '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
    (payload->'pageInfo'->'nextCursor'->>'latestRecordDate')::timestamptz,
    (payload->'pageInfo'->'nextCursor'->>'patientId')::uuid,
    8
  ) as payload
  from first_page
)
select is(
  (
    select count(*)
    from jsonb_array_elements((select payload->'groups' from first_page)) a
    join jsonb_array_elements((select payload->'groups' from second_page)) b
      on a->>'patientId' = b->>'patientId'
  ),
  0::bigint,
  'global cursor pages never repeat a patient group'
);

select is(
  jsonb_array_length(
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', 'jose alvarez', 'all',
      '2026-08-05', null, null, 8
    )->'groups'
  ),
  1,
  'patient name search is resolved in PostgreSQL'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', 'jose alvarez', 'all',
      '2026-08-05', null, null, 8
    )->'groups'->0->>'totalRecords'
  )::integer,
  10,
  'a patient-name match includes that patient complete filtered history'
);

select is(
  jsonb_array_length(
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', 'revision periodontal', 'all',
      '2026-08-05', null, null, 8
    )->'groups'
  ),
  1,
  'clinical-content search is accent insensitive'
);

select is(
  public.get_clinic_clinical_history_page(
    '37000000-0000-4000-8000-000000000101', 'gingivitis moderada', 'all',
    '2026-08-05', null, null, 8
  )->'groups'->0->'records'->0->>'reason',
  'Revisión periodontal',
  'diagnosis search returns the matching clinical record'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'this-month',
      '2026-08-05', null, null, 8
    )->'summary'->>'totalRecords'
  )::integer,
  12,
  'this-month filtering is resolved before pagination'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'last-30-days',
      '2026-08-05', null, null, 8
    )->'summary'->>'totalRecords'
  )::integer,
  12,
  'last-30-days filtering uses a bounded date range'
);

select is(
  jsonb_array_length(
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', 'jose alvarez', 'all',
      '2026-08-05', null, null, 8
    )->'groups'->0->'records'
  ),
  3,
  'each global patient group contains at most three previews'
);

select throws_ok(
  $$
    select public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 31
    )
  $$,
  '22023',
  'INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS',
  'patient page sizes above the maximum are rejected'
);

select throws_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      now(), null, 8
    )
  $$,
  '22023',
  'INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS',
  'partial global cursors are rejected'
);

select throws_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'quarter', '2026-08-05',
      null, null, 8
    )
  $$,
  '22023',
  'INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS',
  'unknown period filters are rejected'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '37000000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);

select throws_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )
  $$,
  '42501',
  'FORBIDDEN',
  'members cannot read another clinic global history'
);

select throws_ok(
  $$
    select public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000001', null, null, 8
    )
  $$,
  '42501',
  'FORBIDDEN',
  'members cannot read another clinic patient history'
);

select is(
  (
    public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000102', '', 'all', '2026-08-05',
      null, null, 8
    )->'summary'->>'totalRecords'
  )::integer,
  1,
  'clinic B receives only its own clinical history'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '37000000-0000-4000-8000-000000000003',
    'role', 'authenticated'
  )::text,
  true
);

select throws_ok(
  $$
    select public.get_clinic_clinical_history_page(
      '37000000-0000-4000-8000-000000000101', '', 'all', '2026-08-05',
      null, null, 8
    )
  $$,
  '42501',
  'FORBIDDEN',
  'reception cannot read clinical history'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '37000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select throws_ok(
  $$
    select public.get_patient_clinical_records_page(
      '37000000-0000-4000-8000-000000000101',
      '37000000-0000-4000-9000-000000000099', null, null, 8
    )
  $$,
  '22023',
  'PATIENT_NOT_FOUND',
  'patient history rejects a patient outside the clinic'
);

select * from finish();

rollback;
