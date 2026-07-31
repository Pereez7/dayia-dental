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

select plan(10);

create temporary table perf003_context (
  initial_clinic_count bigint not null
) on commit drop;

insert into perf003_context (initial_clinic_count)
select count(*) from public.clinics;

insert into public.clinics (id, name, status, created_at, updated_at)
select
  format(
    '31000000-0000-4000-8000-%s',
    lpad(sequence_number::text, 12, '0')
  )::uuid,
  format('PERF-003 Clinic %s', lpad(sequence_number::text, 2, '0')),
  'active',
  '2099-01-01 00:00:00+00'::timestamptz
    + make_interval(secs => sequence_number),
  now()
from generate_series(1, 12) sequence_number;

insert into public.clinic_subscriptions (
  clinic_id,
  plan_id,
  status,
  starts_at,
  current_period_starts_at,
  current_period_ends_at,
  payment_status,
  billing_cycle,
  scheduled_plan_id,
  scheduled_plan_starts_at
)
values
  (
    '31000000-0000-4000-8000-000000000001',
    'basic',
    'active',
    now() - interval '1 month',
    now() - interval '1 month',
    now() - interval '1 day',
    'paid',
    'monthly',
    'medium',
    now() - interval '1 day'
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    'basic',
    'active',
    now() - interval '1 month',
    now() - interval '1 month',
    now() - interval '1 day',
    'paid',
    'monthly',
    'pro',
    now() - interval '1 day'
  );

select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  (
    select array_agg(summary.clinic_name order by summary.created_at desc, summary.clinic_id desc)
    from public.list_platform_clinic_summaries(5, null, null) summary
  ),
  array[
    'PERF-003 Clinic 12',
    'PERF-003 Clinic 11',
    'PERF-003 Clinic 10',
    'PERF-003 Clinic 09',
    'PERF-003 Clinic 08',
    'PERF-003 Clinic 07'
  ]::text[],
  'the first page returns five visible rows plus one bounded look-ahead row'
);

select is(
  (
    select max(summary.total_count)
    from public.list_platform_clinic_summaries(5, null, null) summary
  ),
  (select initial_clinic_count + 12 from perf003_context),
  'the summary exposes the total clinic count without returning every clinic'
);

select is(
  (
    select array_agg(summary.clinic_name order by summary.created_at desc, summary.clinic_id desc)
    from public.list_platform_clinic_summaries(
      5,
      '2099-01-01 00:00:08+00',
      '31000000-0000-4000-8000-000000000008'
    ) summary
  ),
  array[
    'PERF-003 Clinic 07',
    'PERF-003 Clinic 06',
    'PERF-003 Clinic 05',
    'PERF-003 Clinic 04',
    'PERF-003 Clinic 03',
    'PERF-003 Clinic 02'
  ]::text[],
  'the intermediate page advances with the stable created-at and id cursor'
);

select is(
  (
    select subscriptions.plan_id
    from public.clinic_subscriptions subscriptions
    where subscriptions.clinic_id =
      '31000000-0000-4000-8000-000000000002'
  ),
  'pro',
  'the bounded batch applies a scheduled plan reached on the intermediate page'
);

select is(
  (
    select array_agg(summary.clinic_name order by summary.created_at desc, summary.clinic_id desc)
    from public.list_platform_clinic_summaries(
      5,
      '2099-01-01 00:00:03+00',
      '31000000-0000-4000-8000-000000000003'
    ) summary
    where summary.clinic_name like 'PERF-003 Clinic %'
  ),
  array[
    'PERF-003 Clinic 02',
    'PERF-003 Clinic 01'
  ]::text[],
  'the last fixture page contains only the remaining fixture rows'
);

select is(
  (
    select subscriptions.plan_id
    from public.clinic_subscriptions subscriptions
    where subscriptions.clinic_id =
      '31000000-0000-4000-8000-000000000001'
  ),
  'medium',
  'the bounded batch applies a scheduled plan reached on the last page'
);

select is(
  (
    select count(*)
    from public.subscription_events events
    where events.clinic_id in (
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000002'
    )
      and events.event_type = 'plan_changed'
      and events.metadata @> '{"scheduled": true, "batch": true}'::jsonb
  ),
  2::bigint,
  'each plan applied by the batch keeps one audit event'
);

insert into public.clinics (id, name, status, created_at, updated_at)
values (
  '31000000-0000-4000-8000-000000000099',
  'PERF-003 Clinic New',
  'active',
  '2100-01-01 00:00:00+00',
  now()
);

select is(
  (
    select array_agg(summary.clinic_name order by summary.created_at desc, summary.clinic_id desc)
    from public.list_platform_clinic_summaries(
      5,
      '2099-01-01 00:00:08+00',
      '31000000-0000-4000-8000-000000000008'
    ) summary
  ),
  array[
    'PERF-003 Clinic 07',
    'PERF-003 Clinic 06',
    'PERF-003 Clinic 05',
    'PERF-003 Clinic 04',
    'PERF-003 Clinic 03',
    'PERF-003 Clinic 02'
  ]::text[],
  'a new leading clinic does not duplicate or skip rows after an existing cursor'
);

select is(
  (
    select summary.clinic_name
    from public.list_platform_clinic_summaries(5, null, null) summary
    order by summary.created_at desc, summary.clinic_id desc
    limit 1
  ),
  'PERF-003 Clinic New',
  'a fresh first page includes a newly created clinic'
);

select is(
  (
    select max(summary.total_count)
    from public.list_platform_clinic_summaries(5, null, null) summary
  ),
  (select initial_clinic_count + 13 from perf003_context),
  'the total count reflects new clinics without invalidating older cursors'
);

select * from finish();

rollback;
