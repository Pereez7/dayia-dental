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
end;
$setup_pgtap_search_path$;

select plan(16);

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
    '28000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@membership.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '28000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'doctor-a@membership.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '28000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'reception-a@membership.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '28000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'owner-b@membership.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.clinics (id, name, status)
values
  ('28000000-1000-4000-8000-000000000001', 'Membership Clinic A', 'active'),
  ('28000000-1000-4000-8000-000000000002', 'Membership Clinic B', 'active');

insert into public.profiles (id, full_name, role, email, is_platform_admin)
values
  (
    '28000000-0000-0000-0000-000000000001',
    'Owner A',
    'clinic_admin',
    'owner-a@membership.test',
    false
  ),
  (
    '28000000-0000-0000-0000-000000000002',
    'Doctor A',
    'doctor',
    'doctor-a@membership.test',
    false
  ),
  (
    '28000000-0000-0000-0000-000000000003',
    'Clinic Admin A',
    'clinic_admin',
    'reception-a@membership.test',
    false
  ),
  (
    '28000000-0000-0000-0000-000000000004',
    'Owner B',
    'clinic_admin',
    'owner-b@membership.test',
    false
  );

insert into public.clinic_memberships (
  id,
  clinic_id,
  user_id,
  role,
  status,
  activated_at
)
values
  (
    '28000000-2000-4000-8000-000000000001',
    '28000000-1000-4000-8000-000000000001',
    '28000000-0000-0000-0000-000000000001',
    'clinic_owner',
    'active',
    now()
  ),
  (
    '28000000-2000-4000-8000-000000000002',
    '28000000-1000-4000-8000-000000000001',
    '28000000-0000-0000-0000-000000000002',
    'doctor',
    'active',
    now()
  ),
  (
    '28000000-2000-4000-8000-000000000003',
    '28000000-1000-4000-8000-000000000001',
    '28000000-0000-0000-0000-000000000003',
    'clinic_admin',
    'inactive',
    now()
  ),
  (
    '28000000-2000-4000-8000-000000000004',
    '28000000-1000-4000-8000-000000000002',
    '28000000-0000-0000-0000-000000000004',
    'clinic_owner',
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
values
  (
    '28000000-1000-4000-8000-000000000001',
    'pro',
    'active',
    now(),
    now() + interval '30 days',
    now() + interval '35 days',
    'paid',
    'monthly'
  ),
  (
    '28000000-1000-4000-8000-000000000002',
    'pro',
    'active',
    now(),
    now() + interval '30 days',
    now() + interval '35 days',
    'paid',
    'monthly'
  );

select is(
  (
    public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000002',
      'inactive',
      'Finalizó su relación con el consultorio.',
      '28000000-0000-0000-0000-000000000001'
    )->>'status'
  ),
  'inactive',
  'owner can deactivate a non-owner membership'
);

select is(
  (
    select status
    from public.clinic_memberships
    where id = '28000000-2000-4000-8000-000000000002'
  ),
  'inactive',
  'deactivation persists as an inactive membership'
);

select is(
  (
    select action
    from public.clinic_membership_events
    where membership_id = '28000000-2000-4000-8000-000000000002'
    order by created_at desc
    limit 1
  ),
  'deactivated',
  'deactivation creates an audit event'
);

select is(
  (
    select reason
    from public.clinic_membership_events
    where membership_id = '28000000-2000-4000-8000-000000000002'
    order by created_at desc
    limit 1
  ),
  'Finalizó su relación con el consultorio.',
  'audit preserves the administrative reason'
);

select is(
  (
    public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000002',
      'active',
      'Se reincorpora al equipo clínico.',
      '28000000-0000-0000-0000-000000000001'
    )->>'status'
  ),
  'active',
  'owner can reactivate an inactive membership'
);

select is(
  (
    select status
    from public.clinic_memberships
    where id = '28000000-2000-4000-8000-000000000002'
  ),
  'active',
  'reactivation restores the active membership'
);

select is(
  (
    select count(*)
    from public.clinic_membership_events
    where membership_id = '28000000-2000-4000-8000-000000000002'
  ),
  2::bigint,
  'both lifecycle changes remain auditable'
);

update public.plans
set max_users = 2
where id = 'pro';

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000003',
      'active',
      'Se reincorpora como administrador del equipo.',
      '28000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  'MEMBER_LIMIT_REACHED',
  'reactivation cannot exceed the current plan member limit'
);

update public.plans
set max_users = 10
where id = 'pro';

select is(
  (
    public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000003',
      'active',
      'Se reincorpora como administrador del equipo.',
      '28000000-0000-0000-0000-000000000001'
    )->>'status'
  ),
  'active',
  'owner can reactivate an inactive clinic administrator'
);

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000001',
      'inactive',
      'Intento de modificar al propietario.',
      '28000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001',
  'OWNER_PROTECTED',
  'a clinic administrator cannot deactivate the clinic owner'
);

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000001',
      'inactive',
      'Intento de desactivar al propietario.',
      '28000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  'SELF_ACTION_NOT_ALLOWED',
  'the current user cannot deactivate their own access'
);

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000001',
      'inactive',
      'Intento desde otro consultorio.',
      '28000000-0000-0000-0000-000000000004'
    )
  $$,
  'P0001',
  'FORBIDDEN',
  'an owner cannot manage a membership from another clinic'
);

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000004',
      'inactive',
      'Intento de modificar a otro propietario.',
      '28000000-0000-0000-0000-000000000004'
    )
  $$,
  'P0001',
  'SELF_ACTION_NOT_ALLOWED',
  'owner self-protection applies in every clinic'
);

select throws_ok(
  $$
    select public.update_clinic_membership_status(
      '28000000-2000-4000-8000-000000000003',
      'active',
      'ok',
      '28000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  'INVALID_REASON',
  'lifecycle changes require a meaningful reason'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.clinic_membership_events',
    'select'
  ),
  false,
  'authenticated clients cannot read membership audit directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.update_clinic_membership_status(uuid,text,text,uuid)',
    'execute'
  ),
  false,
  'authenticated clients cannot execute the lifecycle RPC directly'
);

select * from finish();

rollback;
