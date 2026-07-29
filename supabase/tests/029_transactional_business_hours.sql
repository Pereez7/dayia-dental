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

select plan(9);

select has_function(
  'public',
  'save_clinic_business_hours',
  array['uuid', 'jsonb'],
  'transactional business-hours function exists'
);

select function_privs_are(
  'public',
  'save_clinic_business_hours',
  array['uuid', 'jsonb'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can execute the protected function'
);

select function_privs_are(
  'public',
  'save_clinic_business_hours',
  array['uuid', 'jsonb'],
  'anon',
  array[]::text[],
  'anonymous users cannot execute the protected function'
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
    '29000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@hours.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '29000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'doctor@hours.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.clinics (id, name, status)
values
  ('29000000-1000-4000-8000-000000000001', 'Hours Clinic A', 'active'),
  ('29000000-1000-4000-8000-000000000002', 'Hours Clinic B', 'active');

insert into public.profiles (id, full_name, role, email, is_platform_admin)
values
  (
    '29000000-0000-0000-0000-000000000001',
    'Owner Hours',
    'clinic_admin',
    'owner@hours.test',
    false
  ),
  (
    '29000000-0000-0000-0000-000000000002',
    'Doctor Hours',
    'doctor',
    'doctor@hours.test',
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
    '29000000-1000-4000-8000-000000000001',
    '29000000-0000-0000-0000-000000000001',
    'clinic_owner',
    'active',
    now()
  ),
  (
    '29000000-1000-4000-8000-000000000001',
    '29000000-0000-0000-0000-000000000002',
    'doctor',
    'active',
    now()
  );

insert into public.clinic_subscriptions (
  clinic_id,
  plan_id,
  status,
  current_period_starts_at,
  current_period_ends_at,
  grace_ends_at,
  payment_status,
  billing_cycle
)
values (
  '29000000-1000-4000-8000-000000000001',
  'pro',
  'active',
  now(),
  now() + interval '30 days',
  now() + interval '35 days',
  'paid',
  'monthly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@hours.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.save_clinic_business_hours(
      '29000000-1000-4000-8000-000000000001',
      '[
        {"weekday":0,"is_open":false,"start_time":null,"end_time":null,"slot_interval_minutes":30},
        {"weekday":1,"is_open":true,"start_time":"08:00","end_time":"18:00","slot_interval_minutes":30},
        {"weekday":2,"is_open":true,"start_time":"08:00","end_time":"18:00","slot_interval_minutes":30},
        {"weekday":3,"is_open":true,"start_time":"08:00","end_time":"18:00","slot_interval_minutes":30},
        {"weekday":4,"is_open":true,"start_time":"08:00","end_time":"18:00","slot_interval_minutes":30},
        {"weekday":5,"is_open":true,"start_time":"08:00","end_time":"18:00","slot_interval_minutes":30},
        {"weekday":6,"is_open":false,"start_time":null,"end_time":null,"slot_interval_minutes":30}
      ]'::jsonb
    )
  ),
  7::bigint,
  'clinic owner saves the complete weekly schedule'
);

select is(
  (
    select start_time::text
    from public.business_hours
    where clinic_id = '29000000-1000-4000-8000-000000000001'
      and weekday = 1
  ),
  '08:00:00',
  'open-day values are persisted'
);

select is(
  (
    select count(*)
    from public.business_hours
    where clinic_id = '29000000-1000-4000-8000-000000000001'
  ),
  7::bigint,
  'one and only one row is stored for each weekday'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"29000000-0000-0000-0000-000000000002","role":"authenticated","email":"doctor@hours.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$
    select public.save_clinic_business_hours(
      '29000000-1000-4000-8000-000000000001',
      '[]'::jsonb
    )
  $$,
  '42501',
  'FORBIDDEN',
  'a doctor cannot save clinic settings'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"29000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@hours.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$
    select public.save_clinic_business_hours(
      '29000000-1000-4000-8000-000000000002',
      '[]'::jsonb
    )
  $$,
  '42501',
  'FORBIDDEN',
  'an owner cannot save another clinic settings'
);

select throws_ok(
  $$
    select public.save_clinic_business_hours(
      '29000000-1000-4000-8000-000000000001',
      '[]'::jsonb
    )
  $$,
  '22023',
  'INVALID_BUSINESS_HOURS',
  'an incomplete weekly schedule is rejected'
);

select * from finish();

rollback;
