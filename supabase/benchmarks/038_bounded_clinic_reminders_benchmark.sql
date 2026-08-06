\timing on
begin;
set local role postgres;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '38800000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'benchmark@perf005e.test', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.clinics (id, name, status)
values ('38800000-0000-4000-8000-000000000101', 'PERF-005E Benchmark', 'active');

insert into public.profiles (id, full_name, email, is_platform_admin)
values (
  '38800000-0000-4000-8000-000000000001',
  'Benchmark PERF-005E', 'benchmark@perf005e.test', false
);

insert into public.clinic_memberships (
  clinic_id, user_id, role, status, activated_at
)
values (
  '38800000-0000-4000-8000-000000000101',
  '38800000-0000-4000-8000-000000000001',
  'clinic_owner', 'active', now()
);

insert into public.clinic_subscriptions (
  clinic_id, plan_id, status, starts_at, is_lifetime
)
values (
  '38800000-0000-4000-8000-000000000101',
  'pro', 'lifetime', now(), true
);

insert into public.patients (
  id, clinic_id, first_name, last_name, phone, email
)
select
  gen_random_uuid(),
  '38800000-0000-4000-8000-000000000101',
  'Paciente', 'Benchmark ' || series.i,
  '+59171' || lpad(series.i::text, 6, '0'),
  'benchmark-' || series.i || '@perf005e.test'
from generate_series(1, 2000) series(i);

create temporary table benchmark_patients as
select id, row_number() over (order by id) as position
from public.patients
where clinic_id = '38800000-0000-4000-8000-000000000101';

insert into public.appointments (
  id, clinic_id, patient_id, appointment_date, start_time, duration_minutes,
  status, reason
)
select
  gen_random_uuid(),
  '38800000-0000-4000-8000-000000000101',
  patients.id,
  case
    when series.i = 19999 then '2026-08-05'::date
    else '2026-07-29'::date + (series.i % 38)
  end,
  '08:00'::time + make_interval(mins => (series.i % 20) * 30),
  30,
  case when series.i % 2 = 0 then 'confirmed' else 'pending' end,
  case when series.i = 19999 then 'Tratamiento objetivo' else 'Control dental' end
from generate_series(1, 20000) series(i)
join benchmark_patients patients
  on patients.position = ((series.i - 1) % 2000) + 1;

insert into public.reminders (
  clinic_id, appointment_id, patient_id, scheduled_at, status, message,
  reminder_type
)
select
  appointments.clinic_id,
  appointments.id,
  appointments.patient_id,
  (appointments.appointment_date + appointments.start_time)
    at time zone 'America/La_Paz' -
    case reminder_types.reminder_type
      when '24h' then interval '24 hours'
      else interval '2 hours'
    end,
  case when reminder_types.reminder_type = '24h' then 'sent' else 'scheduled' end,
  'Recordatorio de benchmark',
  reminder_types.reminder_type
from public.appointments appointments
cross join (values ('24h'), ('2h')) reminder_types(reminder_type)
where appointments.clinic_id = '38800000-0000-4000-8000-000000000101';

analyze public.patients;
analyze public.appointments;
analyze public.reminders;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '38800000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

select jsonb_array_length(
  public.get_clinic_reminder_queue_page(
    '38800000-0000-4000-8000-000000000101', '2026-08-05',
    'all', 'all', '', '2026-08-05', '08:00', null, null, 8
  )->'reminders'
) as initial_page_rows;

select jsonb_array_length(
  public.get_clinic_reminder_queue_page(
    '38800000-0000-4000-8000-000000000101', null,
    'all', 'all', 'objetivo', '2026-08-05', '08:00', null, null, 8
  )->'reminders'
) as searched_page_rows;

explain (analyze, buffers)
select reminders.id
from public.reminders reminders
where reminders.clinic_id = '38800000-0000-4000-8000-000000000101'
  and reminders.appointment_id = (
    select appointments.id
    from public.appointments appointments
    where appointments.clinic_id = '38800000-0000-4000-8000-000000000101'
    limit 1
  )
  and reminders.status in ('pending', 'scheduled')
order by reminders.scheduled_at, reminders.id;

rollback;
