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

  if pgtap_schema is null then
    raise exception 'pgTAP exists but plan(integer) is not installed.';
  end if;

  perform set_config(
    'search_path',
    format('public, extensions, %I', pgtap_schema),
    false
  );
end;
$setup_pgtap_search_path$;

select plan(15);

select has_function(
  'public',
  'get_clinic_agenda_snapshot',
  array[
    'uuid',
    'date',
    'date',
    'integer',
    'time without time zone',
    'uuid'
  ],
  'the bounded agenda RPC exists'
);

select has_index(
  'public',
  'appointments',
  'appointments_clinic_day_schedule_idx',
  'agenda pages have a clinic, date and stable cursor index'
);

select has_index(
  'public',
  'appointment_change_logs',
  'appointment_change_logs_appointment_recent_idx',
  'latest appointment activity has an ordered lookup index'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '34000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner-a@perf005b.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '34000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'owner-b@perf005b.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.clinics (id, name, status)
values
  ('34000000-0000-4000-8000-000000000101', 'PERF-005B Clinic A', 'active'),
  ('34000000-0000-4000-8000-000000000102', 'PERF-005B Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  (
    '34000000-0000-4000-8000-000000000001',
    'Owner PERF-005B A', 'owner-a@perf005b.test', false
  ),
  (
    '34000000-0000-4000-8000-000000000002',
    'Owner PERF-005B B', 'owner-b@perf005b.test', false
  );

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values
  (
    '34000000-0000-4000-8000-000000000101',
    '34000000-0000-4000-8000-000000000001',
    'clinic_owner', 'active', now()
  ),
  (
    '34000000-0000-4000-8000-000000000102',
    '34000000-0000-4000-8000-000000000002',
    'clinic_owner', 'active', now()
  );

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values
  (
    '34000000-0000-4000-8000-000000000101',
    'pro', 'lifetime', now(), true
  ),
  (
    '34000000-0000-4000-8000-000000000102',
    'pro', 'lifetime', now(), true
  );

insert into public.patients (
  id, clinic_id, first_name, last_name, phone
)
select
  format(
    '34000000-0000-4000-9000-%s',
    lpad(sequence_number::text, 12, '0')
  )::uuid,
  '34000000-0000-4000-8000-000000000101'::uuid,
  'Paciente',
  sequence_number::text,
  format('+5917000%s', lpad(sequence_number::text, 4, '0'))
from generate_series(1, 26) sequence_number;

insert into public.patients (id, clinic_id, first_name, last_name, phone)
values (
  '34000000-0000-4000-9000-000000000099',
  '34000000-0000-4000-8000-000000000102',
  'Paciente', 'Otra clínica', '+59179999999'
);

insert into public.appointments (
  id, clinic_id, patient_id, appointment_date, start_time,
  duration_minutes, status, reason
)
select
  format(
    '34000000-0000-4000-a000-%s',
    lpad(sequence_number::text, 12, '0')
  )::uuid,
  '34000000-0000-4000-8000-000000000101'::uuid,
  format(
    '34000000-0000-4000-9000-%s',
    lpad(sequence_number::text, 12, '0')
  )::uuid,
  '2099-09-01'::date,
  '08:00'::time + make_interval(mins => (sequence_number - 1) * 15),
  15,
  case
    when sequence_number <= 23 then 'pending'
    when sequence_number = 24 then 'cancelled'
    else 'completed'
  end,
  'Control'
from generate_series(1, 25) sequence_number;

insert into public.appointments (
  id, clinic_id, patient_id, appointment_date, start_time,
  duration_minutes, status, reason
)
values
  (
    '34000000-0000-4000-a000-000000000026',
    '34000000-0000-4000-8000-000000000101',
    '34000000-0000-4000-9000-000000000026',
    '2099-09-03', '09:00', 30, 'confirmed', 'Control futuro'
  ),
  (
    '34000000-0000-4000-a000-000000000099',
    '34000000-0000-4000-8000-000000000102',
    '34000000-0000-4000-9000-000000000099',
    '2099-09-01', '07:00', 30, 'confirmed', 'Dato aislado'
  );

insert into public.appointment_change_logs (
  id, clinic_id, appointment_id, type, description, created_at
)
values
  (
    '34000000-0000-4000-b000-000000000001',
    '34000000-0000-4000-8000-000000000101',
    '34000000-0000-4000-a000-000000000001',
    'confirmed', 'Confirmación anterior.', '2099-08-31 10:00:00+00'
  ),
  (
    '34000000-0000-4000-b000-000000000002',
    '34000000-0000-4000-8000-000000000101',
    '34000000-0000-4000-a000-000000000001',
    'rescheduled', 'Último cambio.', '2099-08-31 11:00:00+00'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-a@perf005b.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '34000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 5, null, null
    ) -> 'appointments'
  ),
  5,
  'the visible agenda page respects its server limit'
);

select is(
  (
    public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 5, null, null
    ) #>> '{statusSummary,total}'
  )::integer,
  25,
  'the summary counts the complete selected day, not only the visible page'
);

select is(
  jsonb_array_length(
    public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 5, null, null
    ) -> 'availabilityAppointments'
  ),
  23,
  'availability contains only active appointments from the selected day'
);

select is(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5, null, null
  ) #>> '{appointments,0,patientPhone}',
  '+59170000001',
  'the bounded row includes the phone required by the agenda card'
);

select is(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5, null, null
  ) #>> '{appointments,0,changeLog,0,description}',
  'Último cambio.',
  'only the latest relevant audit entry is returned per appointment'
);

select is(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5, null, null
  ) #>> '{pageInfo,hasMore}',
  'true',
  'the first page announces the next cursor'
);

select is(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5,
    '09:00', '34000000-0000-4000-a000-000000000005'
  ) #>> '{appointments,0,id}',
  '34000000-0000-4000-a000-000000000006',
  'the next cursor resumes after the last stable row'
);

select ok(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5, null, null
  ) -> 'dayOptions' @> '["2099-09-03"]'::jsonb,
  'future activity contributes a bounded navigation date'
);

select is(
  public.get_clinic_agenda_snapshot(
    '34000000-0000-4000-8000-000000000101',
    '2099-09-01', '2099-09-01', 5, null, null
  ) #>> '{appointments,0,id}',
  '34000000-0000-4000-a000-000000000001',
  'rows from another clinic never enter the ordered page'
);

select throws_ok(
  $$
    select public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 0, null, null
    )
  $$,
  '22023',
  'INVALID_AGENDA_ARGUMENTS',
  'invalid page sizes are rejected'
);

select throws_ok(
  $$
    select public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 5, '09:00', null
    )
  $$,
  '22023',
  'INVALID_AGENDA_ARGUMENTS',
  'partial cursors are rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated","email":"owner-b@perf005b.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '34000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select public.get_clinic_agenda_snapshot(
      '34000000-0000-4000-8000-000000000101',
      '2099-09-01', '2099-09-01', 5, null, null
    )
  $$,
  '42501',
  'FORBIDDEN',
  'a member cannot read another clinic agenda'
);

select * from finish();
rollback;
