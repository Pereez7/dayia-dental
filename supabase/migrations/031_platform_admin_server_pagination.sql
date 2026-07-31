-- PERF-003: bounded platform administration reads.
-- Additive only: no clinic, membership, payment or audit record is deleted.

create index if not exists clinics_platform_created_id_idx
  on public.clinics (created_at desc, id desc);

create index if not exists subscription_payments_platform_history_idx
  on public.subscription_payments (
    clinic_id,
    paid_at desc,
    created_at desc,
    id desc
  );

create index if not exists subscription_payment_submissions_platform_history_idx
  on public.subscription_payment_submissions (
    clinic_id,
    status,
    created_at desc,
    id desc
  );

create or replace function public.apply_due_scheduled_plans(
  target_clinic_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  if coalesce(cardinality(target_clinic_ids), 0) = 0 then
    return 0;
  end if;

  if auth.role() <> 'service_role'
    and not exists (
      select 1
      from public.profiles profiles
      where profiles.id = auth.uid()
        and profiles.is_platform_admin = true
    ) then
    raise exception 'FORBIDDEN';
  end if;

  with due_subscriptions as materialized (
    select
      subscriptions.id,
      subscriptions.clinic_id,
      subscriptions.plan_id as previous_plan_id,
      subscriptions.scheduled_plan_id as new_plan_id
    from public.clinic_subscriptions subscriptions
    where subscriptions.clinic_id = any(target_clinic_ids)
      and subscriptions.scheduled_plan_id is not null
      and subscriptions.scheduled_plan_starts_at <= now()
    for update
  ),
  updated_subscriptions as (
    update public.clinic_subscriptions subscriptions
    set
      plan_id = due.new_plan_id,
      scheduled_plan_id = null,
      scheduled_plan_starts_at = null,
      updated_at = now()
    from due_subscriptions due
    where subscriptions.id = due.id
    returning
      due.id as subscription_id,
      due.clinic_id,
      due.previous_plan_id,
      due.new_plan_id
  ),
  inserted_events as (
    insert into public.subscription_events (
      clinic_id,
      subscription_id,
      event_type,
      previous_plan_id,
      new_plan_id,
      notes,
      metadata,
      recorded_by
    )
    select
      updated.clinic_id,
      updated.subscription_id,
      'plan_changed',
      updated.previous_plan_id,
      updated.new_plan_id,
      'Cambio programado aplicado al finalizar el periodo.',
      jsonb_build_object('scheduled', true, 'batch', true),
      auth.uid()
    from updated_subscriptions updated
    returning 1
  )
  select count(*)::integer
  into affected_count
  from updated_subscriptions;

  return affected_count;
end;
$$;

revoke all on function public.apply_due_scheduled_plans(uuid[])
  from public, anon, authenticated;
grant execute on function public.apply_due_scheduled_plans(uuid[])
  to service_role;

comment on function public.apply_due_scheduled_plans(uuid[]) is
  'Applies every due scheduled plan for a bounded clinic set in one audited operation.';

create or replace function public.list_platform_clinic_summaries(
  target_limit integer default 10,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null
)
returns table (
  clinic_id uuid,
  clinic_name text,
  clinic_status text,
  created_at timestamptz,
  active_members_count bigint,
  owner_name text,
  owner_email text,
  owner_invitation_sent_at timestamptz,
  owner_membership_status text,
  plan_id text,
  plan_name text,
  subscription_status text,
  pending_payment_submissions_count bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_clinic_ids uuid[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if target_limit < 1 or target_limit > 50 then
    raise exception 'INVALID_PAGE_LIMIT';
  end if;

  if (cursor_created_at is null) <> (cursor_id is null) then
    raise exception 'INVALID_CURSOR';
  end if;

  select array_agg(page.id order by page.created_at desc, page.id desc)
  into selected_clinic_ids
  from (
    select clinics.id, clinics.created_at
    from public.clinics clinics
    where cursor_created_at is null
      or (clinics.created_at, clinics.id) < (cursor_created_at, cursor_id)
    order by clinics.created_at desc, clinics.id desc
    limit target_limit + 1
  ) page;

  if coalesce(cardinality(selected_clinic_ids), 0) = 0 then
    return;
  end if;

  perform public.apply_due_scheduled_plans(selected_clinic_ids);

  return query
  select
    clinics.id,
    clinics.name,
    clinics.status,
    clinics.created_at,
    coalesce(member_counts.active_count, 0),
    primary_owner.full_name,
    primary_owner.email,
    primary_owner.invited_at,
    primary_owner.membership_status,
    subscriptions.plan_id,
    plans.name,
    subscriptions.status,
    coalesce(submission_counts.pending_count, 0),
    (select count(*) from public.clinics)::bigint
  from public.clinics clinics
  left join public.clinic_subscriptions subscriptions
    on subscriptions.clinic_id = clinics.id
  left join public.plans plans
    on plans.id = subscriptions.plan_id
  left join lateral (
    select count(*)::bigint as active_count
    from public.clinic_memberships memberships
    where memberships.clinic_id = clinics.id
      and memberships.status = 'active'
  ) member_counts on true
  left join lateral (
    select
      profiles.full_name,
      profiles.email,
      memberships.invited_at,
      memberships.status as membership_status
    from public.clinic_memberships memberships
    join public.profiles profiles
      on profiles.id = memberships.user_id
    where memberships.clinic_id = clinics.id
      and memberships.role = 'clinic_owner'
      and memberships.status in ('active', 'pending_activation')
    order by
      case memberships.status
        when 'active' then 0
        when 'pending_activation' then 1
        else 2
      end,
      case
        when split_part(lower(btrim(coalesce(profiles.email, ''))), '@', 2)
          in ('test.com', 'example.com', 'example.org', 'localhost')
          or split_part(lower(btrim(coalesce(profiles.email, ''))), '@', 2)
            like '%.test'
        then 1
        else 0
      end,
      memberships.activated_at desc nulls last,
      memberships.created_at desc,
      memberships.user_id
    limit 1
  ) primary_owner on true
  left join lateral (
    select count(*)::bigint as pending_count
    from public.subscription_payment_submissions submissions
    where submissions.clinic_id = clinics.id
      and submissions.status = 'pending_review'
  ) submission_counts on true
  where clinics.id = any(selected_clinic_ids)
  order by clinics.created_at desc, clinics.id desc;
end;
$$;

revoke all on function public.list_platform_clinic_summaries(
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.list_platform_clinic_summaries(
  integer,
  timestamptz,
  uuid
) to service_role;

comment on function public.list_platform_clinic_summaries(
  integer,
  timestamptz,
  uuid
) is
  'Returns one stable cursor page for Platform Admin without payment histories.';
