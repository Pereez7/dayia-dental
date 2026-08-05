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
  join pg_namespace namespaces
    on namespaces.oid = procedures.pronamespace
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

  execute format('grant usage on schema %I to authenticated', pgtap_schema);
end;
$setup_pgtap_search_path$;

select plan(13);

select has_function(
  'public',
  'get_clinic_dashboard_snapshot',
  array['uuid', 'date', 'time without time zone'],
  'the bounded dashboard RPC exists'
);

select has_index(
  'public',
  'appointments',
  'appointments_clinic_active_schedule_idx',
  'active appointments have an ordered partial index'
);

select has_index(
  'public',
  'appointment_change_logs',
  'appointment_change_logs_clinic_created_idx',
  'recent activity has a clinic and timestamp index'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '33000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@perf005.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'owner-b@perf005.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.clinics (id, name, status)
values
  ('33000000-0000-4000-8000-000000000101', 'PERF-005 Clinic A', 'active'),
  ('33000000-0000-4000-8000-000000000102', 'PERF-005 Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  (
    '33000000-0000-4000-8000-000000000001',
    'Owner PERF-005 A',
    'owner-a@perf005.test',
    false
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    'Owner PERF-005 B',
    'owner-b@perf005.test',
    false
  );

insert into public.clinic_memberships (
  clinic_id,
  user_id,
  role,
  status,
  activated_at
)
values
  (
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-8000-000000000001',
    'clinic_owner',
    'active',
    now()
  ),
  (
    '33000000-0000-4000-8000-000000000102',
    '33000000-0000-4000-8000-000000000002',
    'clinic_owner',
    'active',
    now()
  );

insert into public.clinic_subscriptions (
  clinic_id,
  plan_id,
  status,
  starts_at,
  is_lifetime
)
values
  (
    '33000000-0000-4000-8000-000000000101',
    'pro',
    'lifetime',
    now(),
    true
  ),
  (
    '33000000-0000-4000-8000-000000000102',
    'pro',
    'lifetime',
    now(),
    true
  );

insert into public.patients (
  id,
  clinic_id,
  first_name,
  last_name,
  phone,
  created_at
)
select
  format(
    '33000000-0000-4000-9000-%s',
    lpad(sequence_number::text, 12, '0')
  )::uuid,
  '33000000-0000-4000-8000-000000000101'::uuid,
  'Paciente',
  sequence_number::text,
  format('+5917000%s', lpad(sequence_number::text, 4, '0')),
  '2099-08-01 12:00:00+00'::timestamptz
    + make_interval(secs => sequence_number)
from generate_series(1, 8) sequence_number;

insert into public.patients (
  id,
  clinic_id,
  first_name,
  last_name,
  phone
)
values (
  '33000000-0000-4000-9000-000000000099',
  '33000000-0000-4000-8000-000000000102',
  'Paciente',
  'Otra clínica',
  '+59179999999'
);

insert into public.appointments (
  id,
  clinic_id,
  patient_id,
  appointment_date,
  start_time,
  duration_minutes,
  status,
  reason
)
values
  (
    '33000000-0000-4000-a000-000000000001',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000001',
    '2099-08-04', '09:00', 30, 'pending', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000002',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000002',
    '2099-08-04', '11:00', 30, 'confirmed', 'Limpieza'
  ),
  (
    '33000000-0000-4000-a000-000000000003',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000003',
    '2099-08-04', '12:00', 30, 'cancelled', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000004',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000004',
    '2099-08-05', '08:00', 30, 'pending', 'Evaluación'
  ),
  (
    '33000000-0000-4000-a000-000000000005',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000005',
    '2099-08-05', '09:00', 30, 'rescheduled', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000006',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000006',
    '2099-08-06', '09:00', 30, 'confirmed', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000007',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000007',
    '2099-08-07', '09:00', 30, 'confirmed', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000008',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000008',
    '2099-08-08', '09:00', 30, 'confirmed', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000009',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000001',
    '2099-08-01', '09:00', 30, 'cancelled', 'Control'
  ),
  (
    '33000000-0000-4000-a000-000000000010',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-9000-000000000002',
    '2099-08-09', '09:00', 30, 'rescheduled', 'Control'
  );

insert into public.appointment_change_logs (
  id,
  clinic_id,
  appointment_id,
  type,
  description,
  created_at
)
values
  (
    '33000000-0000-4000-b000-000000000001',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000003',
    'cancelled', 'Cita cancelada.', '2099-08-02 14:00:00+00'
  ),
  (
    '33000000-0000-4000-b000-000000000002',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000005',
    'rescheduled', 'Cita reprogramada.', '2099-08-04 13:00:00+00'
  ),
  (
    '33000000-0000-4000-b000-000000000003',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000002',
    'confirmed', 'Cita confirmada.', '2099-08-04 14:00:00+00'
  ),
  (
    '33000000-0000-4000-b000-000000000004',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000004',
    'created', 'Cita creada.', '2099-08-04 15:00:00+00'
  ),
  (
    '33000000-0000-4000-b000-000000000005',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000006',
    'created', 'Cita creada.', '2099-08-04 16:00:00+00'
  ),
  (
    '33000000-0000-4000-b000-000000000006',
    '33000000-0000-4000-8000-000000000101',
    '33000000-0000-4000-a000-000000000007',
    'created', 'Cita creada.', '2099-08-04 17:00:00+00'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"33000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-a@perf005.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '33000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) #>> '{summary,todayAppointments}'
  )::integer,
  2,
  'today counts only active appointments'
);

select is(
  (
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) #>> '{summary,registeredPatients}'
  )::integer,
  8,
  'the patient KPI is aggregated without returning all patients'
);

select is(
  (
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) #>> '{summary,monthlyCancelledAppointments}'
  )::integer,
  2,
  'monthly cancellations include logs and the legacy status fallback'
);

select is(
  (
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) #>> '{summary,monthlyRescheduledAppointments}'
  )::integer,
  2,
  'monthly reschedules include logs and the legacy status fallback'
);

select is(
  jsonb_array_length(
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) -> 'upcomingAppointments'
  ),
  5,
  'upcoming appointments are capped at five'
);

select ok(
  jsonb_array_length(
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) -> 'attentionAppointments'
  ) <= 5,
  'attention candidates are capped at five in the database'
);

select is(
  public.get_clinic_dashboard_snapshot(
    '33000000-0000-4000-8000-000000000101',
    '2099-08-04',
    '10:00'
  ) #>> '{upcomingAppointments,0,id}',
  '33000000-0000-4000-a000-000000000002',
  'past times today are excluded from upcoming appointments'
);

select is(
  jsonb_array_length(
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) -> 'recentActivityAppointments'
  ),
  5,
  'recent activity is capped at five events'
);

select is(
  jsonb_array_length(
    public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    ) -> 'recentPatients'
  ),
  4,
  'recent patients are capped at four'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33000000-0000-4000-8000-000000000002","role":"authenticated","email":"owner-b@perf005.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '33000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select public.get_clinic_dashboard_snapshot(
      '33000000-0000-4000-8000-000000000101',
      '2099-08-04',
      '10:00'
    )
  $$,
  '42501',
  'FORBIDDEN',
  'an active member cannot read another clinic dashboard'
);

select * from finish();
rollback;
