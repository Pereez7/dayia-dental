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

select plan(31);

select has_function(
  'public',
  'create_clinic_appointment',
  array['uuid', 'uuid', 'uuid', 'date', 'time without time zone', 'text'],
  'the atomic appointment creation RPC exists'
);

select has_index(
  'public',
  'appointments',
  'appointments_active_patient_day_idx',
  'active patient-day conflicts have a bounded lookup index'
);

select has_index(
  'public',
  'appointments',
  'appointments_active_clinic_day_time_idx',
  'active overlap checks have a bounded clinic-day lookup index'
);

select has_function(
  'public',
  'reschedule_clinic_appointment',
  array[
    'uuid', 'uuid', 'date', 'time without time zone', 'date',
    'time without time zone', 'text'
  ],
  'the atomic appointment reschedule RPC exists'
);

select function_privs_are(
  'public',
  'assert_clinic_appointment_slot',
  array[
    'uuid', 'uuid', 'date', 'time without time zone', 'integer', 'uuid'
  ],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot call the internal slot assertion directly'
);

select function_privs_are(
  'public',
  'create_clinic_appointment',
  array['uuid', 'uuid', 'uuid', 'date', 'time without time zone', 'text'],
  'anon',
  array[]::text[],
  'anonymous clients cannot create appointments'
);

select function_privs_are(
  'public',
  'create_clinic_appointment',
  array['uuid', 'uuid', 'uuid', 'date', 'time without time zone', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated clinic members can call the creation RPC'
);

select is(
  has_column_privilege(
    'authenticated', 'public.appointments', 'appointment_date', 'INSERT'
  ),
  false,
  'direct appointment creation is revoked from authenticated clients'
);

select is(
  has_column_privilege(
    'authenticated', 'public.appointments', 'start_time', 'UPDATE'
  ),
  false,
  'direct schedule updates are revoked from authenticated clients'
);

select is(
  has_column_privilege(
    'authenticated', 'public.appointments', 'status', 'UPDATE'
  ),
  true,
  'status-only lifecycle updates remain available for the existing flow'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '35000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'owner-a@perf005b2.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '35000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'owner-b@perf005b2.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.clinics (id, name, status)
values
  ('35000000-0000-4000-8000-000000000101', 'PERF-005B2 Clinic A', 'active'),
  ('35000000-0000-4000-8000-000000000102', 'PERF-005B2 Clinic B', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values
  (
    '35000000-0000-4000-8000-000000000001',
    'Owner PERF-005B2 A', 'owner-a@perf005b2.test', false
  ),
  (
    '35000000-0000-4000-8000-000000000002',
    'Owner PERF-005B2 B', 'owner-b@perf005b2.test', false
  );

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values
  (
    '35000000-0000-4000-8000-000000000101',
    '35000000-0000-4000-8000-000000000001',
    'clinic_owner', 'active', now()
  ),
  (
    '35000000-0000-4000-8000-000000000102',
    '35000000-0000-4000-8000-000000000002',
    'clinic_owner', 'active', now()
  );

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values
  (
    '35000000-0000-4000-8000-000000000101',
    'pro', 'lifetime', now(), true
  ),
  (
    '35000000-0000-4000-8000-000000000102',
    'pro', 'lifetime', now(), true
  );

insert into public.business_hours (
  clinic_id, weekday, is_open, start_time, end_time, slot_interval_minutes
)
select
  clinics.id,
  weekdays.weekday,
  true,
  '08:00'::time,
  '18:00'::time,
  30
from (
  values
    ('35000000-0000-4000-8000-000000000101'::uuid),
    ('35000000-0000-4000-8000-000000000102'::uuid)
) clinics(id)
cross join generate_series(0, 6) weekdays(weekday);

insert into public.calendar_exceptions (
  clinic_id, date, type, start_time, end_time, reason
)
values
  (
    '35000000-0000-4000-8000-000000000101',
    '2099-10-02', 'closed', null, null, 'holiday'
  ),
  (
    '35000000-0000-4000-8000-000000000101',
    '2099-10-03', 'special-hours', '10:00', '12:00', 'special-campaign'
  );

insert into public.patients (
  id, clinic_id, first_name, last_name, phone
)
values
  (
    '35000000-0000-4000-9000-000000000001',
    '35000000-0000-4000-8000-000000000101',
    'Ana', 'Atómica', '+59170000001'
  ),
  (
    '35000000-0000-4000-9000-000000000002',
    '35000000-0000-4000-8000-000000000101',
    'Bruno', 'Bloqueo', '+59170000002'
  ),
  (
    '35000000-0000-4000-9000-000000000003',
    '35000000-0000-4000-8000-000000000101',
    'Carla', 'Cursor', '+59170000003'
  ),
  (
    '35000000-0000-4000-9000-000000000099',
    '35000000-0000-4000-8000-000000000102',
    'Paciente', 'Aislado', '+59179999999'
  );

insert into public.treatments (
  id, clinic_id, name, duration_minutes, is_active
)
values
  (
    '35000000-0000-4000-a000-000000000001',
    '35000000-0000-4000-8000-000000000101',
    'Evaluación', 60, true
  ),
  (
    '35000000-0000-4000-a000-000000000002',
    '35000000-0000-4000-8000-000000000101',
    'Control', 30, true
  ),
  (
    '35000000-0000-4000-a000-000000000003',
    '35000000-0000-4000-8000-000000000101',
    'Tratamiento inactivo', 30, false
  ),
  (
    '35000000-0000-4000-a000-000000000099',
    '35000000-0000-4000-8000-000000000102',
    'Tratamiento ajeno', 30, true
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-a@perf005b2.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '35000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.create_clinic_appointment(
    '35000000-0000-4000-8000-000000000101',
    '35000000-0000-4000-9000-000000000001',
    '35000000-0000-4000-a000-000000000001',
    '2099-10-01', '09:00', 'pending'
  ) #>> '{appointment,status}',
  'pending',
  'an authorized member creates an appointment'
);

select is(
  (
    select duration_minutes
    from public.appointments
    where patient_id = '35000000-0000-4000-9000-000000000001'
  ),
  60,
  'the active treatment supplies the authoritative duration'
);

select is(
  (
    select count(*)::integer
    from public.appointment_change_logs
    where clinic_id = '35000000-0000-4000-8000-000000000101'
      and type = 'created'
  ),
  1,
  'creation appends its audit entry in the same operation'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000002',
      '35000000-0000-4000-a000-000000000002',
      '2099-10-01', '09:30', 'pending'
    )
  $$,
  'P0001',
  'APPOINTMENT_SLOT_CONFLICT',
  'an overlapping range is rejected even when start times differ'
);

select is(
  public.create_clinic_appointment(
    '35000000-0000-4000-8000-000000000101',
    '35000000-0000-4000-9000-000000000002',
    '35000000-0000-4000-a000-000000000002',
    '2099-10-01', '10:00', 'confirmed'
  ) #>> '{appointment,start_time}',
  '10:00:00',
  'an appointment may begin exactly when the previous one ends'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000001',
      '35000000-0000-4000-a000-000000000002',
      '2099-10-01', '11:00', 'pending'
    )
  $$,
  'P0001',
  'APPOINTMENT_PATIENT_DAY_CONFLICT',
  'one patient cannot receive two active appointments on the same day'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000003',
      '35000000-0000-4000-a000-000000000002',
      '2099-10-02', '09:00', 'pending'
    )
  $$,
  'P0001',
  'APPOINTMENT_CLOSED_DAY',
  'a closed calendar exception blocks creation'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000003',
      '35000000-0000-4000-a000-000000000002',
      '2099-10-03', '09:00', 'pending'
    )
  $$,
  'P0001',
  'APPOINTMENT_OUTSIDE_BUSINESS_HOURS',
  'special hours replace the weekly opening range'
);

select is(
  public.create_clinic_appointment(
    '35000000-0000-4000-8000-000000000101',
    '35000000-0000-4000-9000-000000000003',
    '35000000-0000-4000-a000-000000000002',
    '2099-10-03', '10:00', 'pending'
  ) #>> '{appointment,appointment_date}',
  '2099-10-03',
  'a slot inside special hours remains available'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000003',
      '35000000-0000-4000-a000-000000000003',
      '2099-10-04', '09:00', 'pending'
    )
  $$,
  'P0001',
  'APPOINTMENT_INVALID_TREATMENT',
  'inactive treatments cannot be scheduled'
);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000102',
      '35000000-0000-4000-9000-000000000099',
      '35000000-0000-4000-a000-000000000099',
      '2099-10-04', '09:00', 'pending'
    )
  $$,
  '42501',
  'FORBIDDEN',
  'a member cannot create appointments in another clinic'
);

select is(
  public.reschedule_clinic_appointment(
    '35000000-0000-4000-8000-000000000101',
    (
      select id from public.appointments
      where patient_id = '35000000-0000-4000-9000-000000000001'
    ),
    '2099-10-01', '09:00',
    '2099-10-05', '11:00', 'Solicitud del paciente'
  ) #>> '{appointment,status}',
  'rescheduled',
  'an active unchanged appointment is rescheduled'
);

select is(
  (
    select count(*)::integer
    from public.appointment_change_logs
    where appointment_id = (
      select id from public.appointments
      where patient_id = '35000000-0000-4000-9000-000000000001'
    )
      and type = 'rescheduled'
  ),
  1,
  'rescheduling appends one audit entry atomically'
);

select throws_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      (
        select id from public.appointments
        where patient_id = '35000000-0000-4000-9000-000000000001'
      ),
      '2099-10-01', '09:00',
      '2099-10-06', '11:00', 'Vista desactualizada'
    )
  $$,
  'P0001',
  'APPOINTMENT_STALE',
  'a stale client cannot overwrite a newer schedule'
);

select throws_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      (
        select id from public.appointments
        where patient_id = '35000000-0000-4000-9000-000000000001'
      ),
      '2099-10-05', '11:00',
      '2099-10-05', '11:00', 'Sin cambio real'
    )
  $$,
  'P0001',
  'APPOINTMENT_NO_SCHEDULE_CHANGE',
  'rescheduling requires a real date or time change'
);

update public.appointments
set status = 'cancelled'
where patient_id = '35000000-0000-4000-9000-000000000002';

select throws_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      (
        select id from public.appointments
        where patient_id = '35000000-0000-4000-9000-000000000002'
      ),
      '2099-10-01', '10:00',
      '2099-10-06', '10:00', 'Cita cancelada'
    )
  $$,
  'P0001',
  'APPOINTMENT_CANNOT_RESCHEDULE',
  'terminal appointments cannot be rescheduled'
);

set local role postgres;

insert into public.appointments (
  id, clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason
)
values (
  '35000000-0000-4000-b000-000000000001',
  '35000000-0000-4000-8000-000000000101',
  '35000000-0000-4000-9000-000000000002',
  '35000000-0000-4000-a000-000000000002',
  '2099-10-06', '09:00', 30, 'pending', 'Control'
);

set local role authenticated;

select throws_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      (
        select id from public.appointments
        where patient_id = '35000000-0000-4000-9000-000000000001'
      ),
      '2099-10-05', '11:00',
      '2099-10-06', '09:00', 'Horario solicitado'
    )
  $$,
  'P0001',
  'APPOINTMENT_SLOT_CONFLICT',
  'rescheduling cannot overlap another active appointment'
);

select throws_ok(
  $$
    select public.reschedule_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      (
        select id from public.appointments
        where patient_id = '35000000-0000-4000-9000-000000000001'
      ),
      '2099-10-05', '11:00',
      '2099-10-07', '09:00', ''
    )
  $$,
  '22023',
  'APPOINTMENT_INVALID_REASON',
  'rescheduling requires an auditable reason'
);

set local role postgres;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$
    select public.create_clinic_appointment(
      '35000000-0000-4000-8000-000000000101',
      '35000000-0000-4000-9000-000000000003',
      '35000000-0000-4000-a000-000000000002',
      '2099-10-07', '09:00', 'pending'
    )
  $$,
  '42501',
  'AUTH_REQUIRED',
  'an unauthenticated context cannot schedule appointments'
);

select is(
  (
    select count(*)::integer
    from public.appointments
    where clinic_id = '35000000-0000-4000-8000-000000000101'
  ),
  4,
  'failed scheduling attempts leave no partial appointments'
);

select is(
  (
    select count(*)::integer
    from public.appointment_change_logs
    where clinic_id = '35000000-0000-4000-8000-000000000101'
  ),
  4,
  'only successful atomic operations leave audit entries'
);

select * from finish();
rollback;
