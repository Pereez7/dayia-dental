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

select plan(27);

select has_function(
  'public', 'reconcile_clinic_reminders',
  array['uuid', 'timestamp with time zone'],
  'the atomic reminder reconciliation RPC exists'
);

select has_function(
  'public', 'get_clinic_reminder_queue_page',
  array[
    'uuid', 'date', 'text', 'text', 'text', 'date', 'time without time zone',
    'time without time zone', 'uuid', 'integer'
  ],
  'the bounded reminder queue RPC exists'
);

select has_index(
  'public', 'reminders', 'reminders_clinic_appointment_status_schedule_idx',
  'the queue has a clinic and appointment lookup index'
);

select function_privs_are(
  'public', 'get_clinic_reminder_queue_page',
  array[
    'uuid', 'date', 'text', 'text', 'text', 'date', 'time without time zone',
    'time without time zone', 'uuid', 'integer'
  ],
  'anon', array[]::text[],
  'anonymous users cannot read the reminder queue'
);

select function_privs_are(
  'public', 'reconcile_clinic_reminders',
  array['uuid', 'timestamp with time zone'],
  'anon', array[]::text[],
  'anonymous users cannot reconcile reminders'
);

select function_privs_are(
  'public', 'get_clinic_reminder_queue_page',
  array[
    'uuid', 'date', 'text', 'text', 'text', 'date', 'time without time zone',
    'time without time zone', 'uuid', 'integer'
  ],
  'authenticated', array['EXECUTE'],
  'authorized operational roles can call the queue RPC'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '38000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner@perf005e.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '38000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'reception@perf005e.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '38000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'doctor@perf005e.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '38000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'other@perf005e.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.clinics (id, name, status)
values
  ('38000000-0000-4000-8000-000000000101', 'PERF-005E Clinic A', 'active'),
  ('38000000-0000-4000-8000-000000000102', 'PERF-005E Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  ('38000000-0000-4000-8000-000000000001', 'Owner E', 'owner@perf005e.test', false),
  ('38000000-0000-4000-8000-000000000002', 'Reception E', 'reception@perf005e.test', false),
  ('38000000-0000-4000-8000-000000000003', 'Doctor E', 'doctor@perf005e.test', false),
  ('38000000-0000-4000-8000-000000000004', 'Other E', 'other@perf005e.test', false);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values
  ('38000000-0000-4000-8000-000000000101', '38000000-0000-4000-8000-000000000001', 'clinic_owner', 'active', now()),
  ('38000000-0000-4000-8000-000000000101', '38000000-0000-4000-8000-000000000002', 'receptionist', 'active', now()),
  ('38000000-0000-4000-8000-000000000101', '38000000-0000-4000-8000-000000000003', 'doctor', 'active', now()),
  ('38000000-0000-4000-8000-000000000102', '38000000-0000-4000-8000-000000000004', 'clinic_owner', 'active', now());

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values
  ('38000000-0000-4000-8000-000000000101', 'pro', 'lifetime', now(), true),
  ('38000000-0000-4000-8000-000000000102', 'pro', 'lifetime', now(), true);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email
)
values
  ('38000000-0000-4000-9000-000000000001', '38000000-0000-4000-8000-000000000101', 'Ana', 'Prado', '+59170000001', 'ana@perf005e.test'),
  ('38000000-0000-4000-9000-000000000002', '38000000-0000-4000-8000-000000000101', 'Bruno', 'Soto', '+59170000002', 'bruno@perf005e.test'),
  ('38000000-0000-4000-9000-000000000003', '38000000-0000-4000-8000-000000000102', 'Paciente', 'Ajeno', '+59170000003', 'other-patient@perf005e.test');

insert into public.appointments (
  id, clinic_id, patient_id, appointment_date, start_time, duration_minutes,
  status, reason
)
values
  ('38000000-0000-4000-9100-000000000001', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9000-000000000001', '2026-08-04', '09:00', 30, 'pending', 'Control preventivo'),
  ('38000000-0000-4000-9100-000000000002', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9000-000000000001', '2026-08-06', '11:00', 30, 'completed', 'Limpieza'),
  ('38000000-0000-4000-9100-000000000003', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9000-000000000001', '2026-08-05', '09:00', 30, 'pending', 'Ortodoncia'),
  ('38000000-0000-4000-9100-000000000004', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9000-000000000002', '2026-08-05', '10:00', 30, 'confirmed', 'Cirugía'),
  ('38000000-0000-4000-9100-000000000005', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9000-000000000002', '2026-09-10', '10:00', 30, 'confirmed', 'Fuera de ventana'),
  ('38000000-0000-4000-9100-000000000006', '38000000-0000-4000-8000-000000000102', '38000000-0000-4000-9000-000000000003', '2026-08-05', '08:00', 30, 'confirmed', 'Registro ajeno');

insert into public.reminders (
  id, clinic_id, appointment_id, patient_id, scheduled_at, status, message,
  reminder_type
)
values
  ('38000000-0000-4000-9200-000000000001', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000001', '38000000-0000-4000-9000-000000000001', '2026-08-04 08:00:00-04', 'scheduled', 'Pasado', '2h'),
  ('38000000-0000-4000-9200-000000000002', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000002', '38000000-0000-4000-9000-000000000001', '2026-08-06 09:00:00-04', 'scheduled', 'Terminal', '2h'),
  ('38000000-0000-4000-9200-000000000003', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000003', '38000000-0000-4000-9000-000000000001', '2026-08-04 09:00:00-04', 'sent', 'Hoy 24h', '24h'),
  ('38000000-0000-4000-9200-000000000004', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000003', '38000000-0000-4000-9000-000000000001', '2026-08-05 07:00:00-04', 'failed', 'Hoy 2h', '2h'),
  ('38000000-0000-4000-9200-000000000005', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000004', '38000000-0000-4000-9000-000000000002', '2026-08-05 08:00:00-04', 'scheduled', 'Bruno', '2h'),
  ('38000000-0000-4000-9200-000000000006', '38000000-0000-4000-8000-000000000101', '38000000-0000-4000-9100-000000000005', '38000000-0000-4000-9000-000000000002', '2026-09-10 08:00:00-04', 'scheduled', 'Fuera', '2h'),
  ('38000000-0000-4000-9200-000000000007', '38000000-0000-4000-8000-000000000102', '38000000-0000-4000-9100-000000000006', '38000000-0000-4000-9000-000000000003', '2026-08-05 06:00:00-04', 'scheduled', 'Ajeno', '2h');

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '38000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select is(
  (public.reconcile_clinic_reminders(
    '38000000-0000-4000-8000-000000000101',
    '2026-08-05 08:00:00-04'
  )->>'skippedCount')::integer,
  1,
  'one past active reminder is omitted atomically'
);

select is(
  (select status from public.reminders where id = '38000000-0000-4000-9200-000000000001'),
  'skipped',
  'the past reminder is persisted as skipped'
);

select is(
  (select metadata->>'appointment_date' from public.reminders where id = '38000000-0000-4000-9200-000000000001'),
  '2026-08-04',
  'the skipped reminder preserves its original occurrence date'
);

select is(
  (select status from public.reminders where id = '38000000-0000-4000-9200-000000000002'),
  'cancelled',
  'a reminder for a terminal appointment is cancelled'
);

select is(
  public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 1
  )->>'selectedDate',
  '2026-08-05',
  'today is selected when the operational window contains reminders today'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 1
  )->'reminders'),
  2,
  'pagination keeps both reminders from one appointment occurrence together'
);

select is(
  (public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 1
  )->'pageInfo'->>'hasMore')::boolean,
  true,
  'the first appointment group reports another page'
);

select ok(
  public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 1
  )->'pageInfo'->'nextCursor' is not null,
  'the first page exposes a stable cursor'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'scheduled', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )->'reminders'),
  1,
  'the reminder status filter executes in the database'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'confirmed', '',
    '2026-08-05', '08:00', null, null, 8
  )->'reminders'),
  1,
  'the appointment status filter executes in the database'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', 'Bruno cirugía',
    '2026-08-05', '08:00', null, null, 8
  )->'reminders'),
  1,
  'patient and treatment search executes in the database'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )->'dateOptions'),
  3,
  'date options exclude reminders outside the bounded window'
);

select is(
  (public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )->'summary'->>'total')::integer,
  5,
  'the window summary excludes the out-of-window reminder'
);

select is(
  (public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )->'selectedDateSummary'->>'total')::integer,
  3,
  'the selected date summary counts all statuses before filtering'
);

select is(
  jsonb_array_length(public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', '2026-08-05', 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )->'appointments'),
  2,
  'only appointments visible on the bounded page are returned'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '38000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text,
  true
);

select lives_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )$$,
  'reception can manage the reminder queue'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '38000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )$$,
  '42501', 'FORBIDDEN',
  'doctors cannot open the operational reminder queue'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '38000000-0000-4000-8000-000000000004', 'role', 'authenticated')::text,
  true
);

select throws_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )$$,
  '42501', 'FORBIDDEN',
  'another clinic cannot read this reminder queue'
);

select set_config('request.jwt.claims', '{}'::text, true);

select throws_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )$$,
  '42501', 'FORBIDDEN',
  'an unauthenticated request is rejected'
);

select throws_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'invalid', 'all', '',
    '2026-08-05', '08:00', null, null, 8
  )$$,
  '22023', 'INVALID_REMINDER_QUEUE_PAGE_ARGUMENTS',
  'invalid filters are rejected'
);

select throws_ok(
  $$select public.get_clinic_reminder_queue_page(
    '38000000-0000-4000-8000-000000000101', null, 'all', 'all', '',
    '2026-08-05', '08:00', '09:00', null, 8
  )$$,
  '22023', 'INVALID_REMINDER_QUEUE_PAGE_ARGUMENTS',
  'partial cursors are rejected'
);

select * from finish();
rollback;
