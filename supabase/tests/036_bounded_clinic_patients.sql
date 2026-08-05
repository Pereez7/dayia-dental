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

select plan(26);

select has_function(
  'public',
  'get_clinic_patients_page',
  array[
    'uuid', 'text', 'date', 'timestamp with time zone', 'uuid', 'integer'
  ],
  'the bounded patient page RPC exists'
);

select has_index(
  'public', 'patients', 'patients_search_trgm_idx',
  'patient search has a trigram index'
);

select has_index(
  'public', 'patients', 'patients_clinic_phone_normalized_uidx',
  'normalized clinic phone duplicates have a unique index'
);

select has_index(
  'public', 'patients', 'patients_clinic_email_normalized_uidx',
  'normalized clinic email duplicates have a unique index'
);

select function_privs_are(
  'public',
  'get_clinic_patients_page',
  array[
    'uuid', 'text', 'date', 'timestamp with time zone', 'uuid', 'integer'
  ],
  'anon',
  array[]::text[],
  'anonymous users cannot list clinic patients'
);

select function_privs_are(
  'public',
  'get_clinic_patients_page',
  array[
    'uuid', 'text', 'date', 'timestamp with time zone', 'uuid', 'integer'
  ],
  'authenticated',
  array['EXECUTE'],
  'authenticated clinic members can call the patient page RPC'
);

select is(
  public.normalize_patient_search('  José   Álvarez +591 700-123  '),
  'jose alvarez +591 700 123',
  'patient search normalization removes accents and repeated whitespace'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '36000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner-a@perf005c.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '36000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'owner-b@perf005c.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.clinics (id, name, status)
values
  ('36000000-0000-4000-8000-000000000101', 'PERF-005C Clinic A', 'active'),
  ('36000000-0000-4000-8000-000000000102', 'PERF-005C Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  (
    '36000000-0000-4000-8000-000000000001',
    'Owner PERF-005C A', 'owner-a@perf005c.test', false
  ),
  (
    '36000000-0000-4000-8000-000000000002',
    'Owner PERF-005C B', 'owner-b@perf005c.test', false
  );

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values
  (
    '36000000-0000-4000-8000-000000000101',
    '36000000-0000-4000-8000-000000000001',
    'clinic_owner', 'active', now()
  ),
  (
    '36000000-0000-4000-8000-000000000102',
    '36000000-0000-4000-8000-000000000002',
    'clinic_owner', 'active', now()
  );

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values
  (
    '36000000-0000-4000-8000-000000000101',
    'pro', 'lifetime', now(), true
  ),
  (
    '36000000-0000-4000-8000-000000000102',
    'pro', 'lifetime', now(), true
  );

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email, created_at
)
select
  ('36000000-0000-4000-9000-' || lpad(series.i::text, 12, '0'))::uuid,
  '36000000-0000-4000-8000-000000000101'::uuid,
  case when series.i = 1 then 'José' else 'Paciente' end,
  case when series.i = 1 then 'Álvarez' else 'Número ' || series.i end,
  '+5917000' || lpad(series.i::text, 4, '0'),
  case
    when series.i = 1 then 'jose.alvarez@example.com'
    else 'patient' || series.i || '@example.com'
  end,
  '2026-08-05 12:00:00+00'::timestamptz - make_interval(mins => series.i)
from generate_series(1, 15) series(i);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email, created_at
)
values (
  '36000000-0000-4000-9000-000000000099',
  '36000000-0000-4000-8000-000000000102',
  'Paciente', 'Otro consultorio', '+59179999999',
  'other@example.com', '2026-08-05 12:30:00+00'
);

insert into public.appointments (
  clinic_id, patient_id, appointment_date, start_time, duration_minutes,
  status, reason
)
values
  (
    '36000000-0000-4000-8000-000000000101',
    '36000000-0000-4000-9000-000000000001',
    '2026-08-01', '09:00', 30, 'completed', 'Control anterior'
  ),
  (
    '36000000-0000-4000-8000-000000000101',
    '36000000-0000-4000-9000-000000000001',
    '2026-08-12', '10:00', 30, 'confirmed', 'Próximo control'
  );

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '36000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select is(
  jsonb_array_length(
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      null, null, 12
    )->'patients'
  ),
  12,
  'the first page respects its fixed limit'
);

select is(
  (
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      null, null, 12
    )->'pageInfo'->>'hasMore'
  )::boolean,
  true,
  'the first page reports more rows'
);

select ok(
  public.get_clinic_patients_page(
    '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
    null, null, 12
  )->'pageInfo'->'nextCursor' is not null,
  'the first page returns a stable cursor'
);

with first_page as (
  select public.get_clinic_patients_page(
    '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
    null, null, 12
  ) as payload
)
select is(
  jsonb_array_length(
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      (payload->'pageInfo'->'nextCursor'->>'createdAt')::timestamptz,
      (payload->'pageInfo'->'nextCursor'->>'id')::uuid,
      12
    )->'patients'
  ),
  3,
  'the second page contains only the remaining clinic patients'
)
from first_page;

with first_page as (
  select public.get_clinic_patients_page(
    '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
    null, null, 12
  ) as payload
),
second_page as (
  select public.get_clinic_patients_page(
    '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
    (payload->'pageInfo'->'nextCursor'->>'createdAt')::timestamptz,
    (payload->'pageInfo'->'nextCursor'->>'id')::uuid,
    12
  ) as payload
  from first_page
)
select is(
  (
    select count(*)
    from jsonb_array_elements((select payload->'patients' from first_page)) a
    join jsonb_array_elements((select payload->'patients' from second_page)) b
      on a->>'id' = b->>'id'
  ),
  0::bigint,
  'cursor pages never repeat a patient'
);

select is(
  jsonb_array_length(
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', 'jose alvarez',
      '2026-08-05', null, null, 12
    )->'patients'
  ),
  1,
  'accent-insensitive full-name search is resolved in PostgreSQL'
);

select is(
  public.get_clinic_patients_page(
    '36000000-0000-4000-8000-000000000101', 'jose alvarez',
    '2026-08-05', null, null, 12
  )->'patients'->0->>'fullName',
  'José Álvarez',
  'name search returns the expected patient'
);

select is(
  jsonb_array_length(
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '70000001',
      '2026-08-05', null, null, 12
    )->'patients'
  ),
  1,
  'phone search is resolved in PostgreSQL'
);

select is(
  jsonb_array_length(
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', 'JOSE.ALVAR',
      '2026-08-05', null, null, 12
    )->'patients'
  ),
  1,
  'email search is case-insensitive'
);

select is(
  (
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', 'jose alvarez',
      '2026-08-05', null, null, 12
    )->'patients'->0->>'lastVisit'
  ),
  '2026-08-01',
  'the page returns the real last completed visit'
);

select is(
  (
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', 'jose alvarez',
      '2026-08-05', null, null, 12
    )->'patients'->0->>'nextAppointment'
  ),
  '2026-08-12',
  'the page returns the real next active appointment'
);

select is(
  (
    public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', 'jose alvarez',
      '2026-08-05', null, null, 12
    )->'patients'->0
  ) ? 'notes',
  false,
  'the list payload excludes clinical notes'
);

select throws_ok(
  $$
    select public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      null, null, 31
    )
  $$,
  '22023',
  'INVALID_PATIENT_PAGE_ARGUMENTS',
  'page sizes above the fixed maximum are rejected'
);

select throws_ok(
  $$
    select public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      now(), null, 12
    )
  $$,
  '22023',
  'INVALID_PATIENT_PAGE_ARGUMENTS',
  'partial cursors are rejected'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '36000000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);

select throws_ok(
  $$
    select public.get_clinic_patients_page(
      '36000000-0000-4000-8000-000000000101', '', '2026-08-05',
      null, null, 12
    )
  $$,
  '42501',
  'FORBIDDEN',
  'members cannot read another clinic patient page'
);

set local role postgres;

select throws_ok(
  $$
    insert into public.patients (
      clinic_id, first_name, last_name, phone
    ) values (
      '36000000-0000-4000-8000-000000000101',
      'Teléfono', 'Duplicado', '+591 7000-0001'
    )
  $$,
  '23505',
  null,
  'normalized duplicate phones are rejected atomically'
);

select throws_ok(
  $$
    insert into public.patients (
      clinic_id, first_name, last_name, phone, email
    ) values (
      '36000000-0000-4000-8000-000000000101',
      'Correo', 'Duplicado', '+59178888888', ' JOSE.ALVAREZ@EXAMPLE.COM '
    )
  $$,
  '23505',
  null,
  'normalized duplicate emails are rejected atomically'
);

select lives_ok(
  $$
    insert into public.patients (
      clinic_id, first_name, last_name, phone, email
    ) values (
      '36000000-0000-4000-8000-000000000102',
      'Dato', 'Compartido', '+59170000001', 'jose.alvarez@example.com'
    )
  $$,
  'the same phone and email remain valid in another clinic'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      public.get_clinic_patients_page(
        '36000000-0000-4000-8000-000000000102', '', '2026-08-05',
        null, null, 12
      )->'patients'
    ) patients
    where patients->>'fullName' = 'José Álvarez'
  ),
  0::bigint,
  'clinic B never receives clinic A patient data'
);

select * from finish();

rollback;
