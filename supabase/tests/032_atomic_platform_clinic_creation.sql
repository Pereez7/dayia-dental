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

select plan(31);

select ok(
  to_regclass('public.platform_clinic_creation_requests') is not null,
  'the restricted creation ledger exists'
);

select ok(
  to_regclass('public.profiles_normalized_email_unique_idx') is not null,
  'profile emails have one global normalized unique index'
);

select ok(
  to_regclass('public.platform_clinic_creation_requester_payload_idx') is not null,
  'the requester and payload fingerprint form an idempotency key'
);

select has_function(
  'public',
  'lookup_auth_user_by_email',
  array['text'],
  'exact Auth lookup exists'
);

select has_function(
  'public',
  'begin_platform_clinic_creation',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'creation preflight and reservation function exists'
);

select has_function(
  'public',
  'complete_platform_clinic_creation',
  array['uuid', 'uuid'],
  'atomic creation completion function exists'
);

select function_privs_are(
  'public',
  'begin_platform_clinic_creation',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot reserve platform clinic creation'
);

select function_privs_are(
  'public',
  'begin_platform_clinic_creation',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'service_role',
  array['EXECUTE'],
  'only trusted backend code can reserve platform clinic creation'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '32000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'perf004-admin@dayia.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (
  id,
  full_name,
  email,
  is_active,
  is_platform_admin,
  role
)
values (
  '32000000-0000-4000-8000-000000000001',
  'PERF-004 Admin',
  'perf004-admin@dayia.test',
  true,
  true,
  null
);

update public.plans
set monthly_price = 299, founder_monthly_price = 249, is_active = true
where id = 'medium';

select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  public.lookup_auth_user_by_email('missing-perf004@dayia.test'),
  null::jsonb,
  'exact Auth lookup returns null without scanning user pages'
);

select is(
  (
    public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000101',
      '32000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      '  PERF-004   Dental Norte ',
      ' Dra.   Andrea Norte ',
      ' OWNER-PERF004@DAYIA.TEST ',
      'medium',
      'founder'
    )->>'status'
  ),
  'reserved',
  'valid plan and tariff are checked before reserving the request'
);

select is(
  (
    public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000199',
      '32000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      'PERF-004 Dental Norte',
      'Dra. Andrea Norte',
      'owner-perf004@dayia.test',
      'medium',
      'founder'
    )->>'requestId'
  ),
  '32000000-0000-4000-8000-000000000101',
  'the same normalized payload returns its original request'
);

select throws_ok(
  $$
    select public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000198',
      '32000000-0000-4000-8000-000000000001',
      repeat('b', 64),
      'PERF-004 Dental Norte',
      'Otro propietario',
      'other-perf004@dayia.test',
      'medium',
      'standard'
    )
  $$,
  'P0001',
  'CLINIC_CREATION_IN_PROGRESS',
  'a concurrent normalized clinic name cannot create a second reservation'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '32000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'owner-perf004@dayia.test',
  '',
  null,
  '{}'::jsonb,
  jsonb_build_object(
    'full_name', 'Dra. Andrea Norte',
    'dayia_creation_request_id',
    '32000000-0000-4000-8000-000000000101'
  ),
  now(),
  now()
);

select is(
  public.lookup_auth_user_by_email(' OWNER-PERF004@DAYIA.TEST ')->>'id',
  '32000000-0000-4000-8000-000000000002',
  'exact normalized Auth lookup finds the invited owner'
);

select is(
  (
    public.complete_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000101',
      '32000000-0000-4000-8000-000000000002'
    )->>'status'
  ),
  'completed',
  'one transaction completes all public clinic records'
);

select is(
  (
    select count(*)
    from public.clinics
    where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) =
      'perf-004 dental norte'
  ),
  1::bigint,
  'exactly one clinic exists after completion'
);

select is(
  (
    select count(*)
    from public.profiles
    where id = '32000000-0000-4000-8000-000000000002'
      and lower(btrim(email)) = 'owner-perf004@dayia.test'
  ),
  1::bigint,
  'the owner profile is committed with the normalized email'
);

select is(
  (
    select count(*)
    from public.clinic_memberships
    where user_id = '32000000-0000-4000-8000-000000000002'
      and role = 'clinic_owner'
      and status = 'pending_activation'
  ),
  1::bigint,
  'the pending owner membership is committed once'
);

select is(
  (
    select count(*)
    from public.clinic_subscriptions subscriptions
    join public.clinics clinics on clinics.id = subscriptions.clinic_id
    where clinics.name = 'PERF-004 Dental Norte'
      and subscriptions.plan_id = 'medium'
      and subscriptions.status = 'trialing'
      and subscriptions.price_tier = 'founder'
      and subscriptions.founder_price_locked = true
  ),
  1::bigint,
  'the configured trial subscription is committed once'
);

select is(
  (
    public.complete_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000101',
      '32000000-0000-4000-8000-000000000002'
    )->>'clinicId'
  ),
  (
    select clinic_id::text
    from public.platform_clinic_creation_requests
    where id = '32000000-0000-4000-8000-000000000101'
  ),
  'repeating completion returns the committed clinic instead of duplicating it'
);

select is(
  (
    public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000197',
      '32000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      'PERF-004 Dental Norte',
      'Dra. Andrea Norte',
      'owner-perf004@dayia.test',
      'medium',
      'founder'
    )->>'status'
  ),
  'completed',
  'a safe retry after a lost response returns the completed operation'
);

select throws_ok(
  $$
    select public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000196',
      '32000000-0000-4000-8000-000000000001',
      repeat('c', 64),
      'PERF-004 Dental Sur',
      'Otra propietaria',
      'owner-perf004@dayia.test',
      'medium',
      'standard'
    )
  $$,
  'P0001',
  'OWNER_EMAIL_ALREADY_REGISTERED',
  'a completed owner email cannot be assigned to another clinic'
);

select is(
  (
    public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000102',
      '32000000-0000-4000-8000-000000000001',
      repeat('d', 64),
      'PERF-004 Atomic Failure',
      'Dra. Error Controlado',
      'atomic-failure-perf004@dayia.test',
      'medium',
      'standard'
    )->>'status'
  ),
  'reserved',
  'a second independent request can be reserved'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '32000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'atomic-failure-perf004@dayia.test',
  '',
  null,
  '{}'::jsonb,
  '{"dayia_creation_request_id":"wrong-request"}'::jsonb,
  now(),
  now()
);

select throws_ok(
  $$
    select public.complete_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000102',
      '32000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  'OWNER_REQUEST_MISMATCH',
  'completion rejects an Auth user that is not owned by the reservation'
);

select is(
  (
    select count(*)
    from public.clinics
    where name = 'PERF-004 Atomic Failure'
  ),
  0::bigint,
  'an intermediate completion failure leaves no clinic'
);

select is(
  (
    select count(*)
    from public.profiles
    where id = '32000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'an intermediate completion failure leaves no profile'
);

select is(
  (
    select status
    from public.platform_clinic_creation_requests
    where id = '32000000-0000-4000-8000-000000000102'
  ),
  'reserved',
  'the recoverable request remains reserved until compensation is confirmed'
);

select ok(
  public.fail_platform_clinic_creation(
    '32000000-0000-4000-8000-000000000102',
    'OWNER_REQUEST_MISMATCH'
  ),
  'trusted compensation can mark the uncommitted reservation as failed'
);

select is(
  (
    select status
    from public.platform_clinic_creation_requests
    where id = '32000000-0000-4000-8000-000000000102'
  ),
  'failed',
  'failed compensation releases the clinic and email reservations'
);

update public.plans
set is_active = false
where id = 'basic';

select throws_ok(
  $$
    select public.begin_platform_clinic_creation(
      '32000000-0000-4000-8000-000000000103',
      '32000000-0000-4000-8000-000000000001',
      repeat('e', 64),
      'PERF-004 Invalid Plan',
      'Dra. Sin Plan',
      'invalid-plan-perf004@dayia.test',
      'basic',
      'standard'
    )
  $$,
  'P0001',
  'INVALID_PLAN',
  'an inactive plan is rejected before any resource is created'
);

select is(
  (
    select count(*)
    from public.platform_clinic_creation_requests
    where id = '32000000-0000-4000-8000-000000000103'
  ),
  0::bigint,
  'invalid commercial configuration leaves no reservation'
);

select is(
  (
    select count(*)
    from public.clinics
    where name like 'PERF-004%'
  ),
  1::bigint,
  'all retries and failures still produce only the intended clinic'
);

select * from finish();

rollback;
