-- Secure owner plan changes and preserve the requested billing context.

alter table public.subscription_payment_submissions
  add column if not exists previous_plan_id text references public.plans(id),
  add column if not exists payment_type text not null default 'regular',
  add column if not exists effective_at timestamptz;

alter table public.subscription_payment_submissions
  drop constraint if exists subscription_payment_submissions_payment_type_allowed;

alter table public.subscription_payment_submissions
  add constraint subscription_payment_submissions_payment_type_allowed check (
    payment_type in (
      'regular',
      'upgrade_proration',
      'reactivation_plan_change'
    )
  );

revoke insert on public.subscription_payment_submissions from authenticated;

drop policy if exists subscription_payment_submissions_owner_insert
  on public.subscription_payment_submissions;

alter table public.subscription_payments
  drop constraint if exists subscription_payments_type_allowed;

alter table public.subscription_payments
  add constraint subscription_payments_type_allowed check (
    payment_type in (
      'regular',
      'upgrade_proration',
      'reactivation_plan_change',
      'custom_days',
      'lifetime',
      'manual_adjustment'
    )
  );

alter table public.subscription_events
  drop constraint if exists subscription_events_type_allowed;

alter table public.subscription_events
  add constraint subscription_events_type_allowed check (
    event_type in (
      'plan_changed',
      'payment_registered',
      'payment_voided',
      'payment_submission_rejected',
      'founder_enabled',
      'founder_removed',
      'custom_price_set',
      'extra_days_granted',
      'blocked',
      'reactivated',
      'lifetime_enabled',
      'lifetime_disabled',
      'downgrade_scheduled',
      'downgrade_cancelled',
      'standard_price_restored',
      'cancelled'
    )
  );

create or replace function public.schedule_subscription_downgrade(
  target_clinic_id uuid,
  target_plan_id text,
  target_recorded_by uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subscription public.clinic_subscriptions%rowtype;
  target_effective_at timestamptz;
  current_rank integer;
  requested_rank integer;
begin
  if not exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.clinic_id = target_clinic_id
      and memberships.user_id = target_recorded_by
      and memberships.role = 'clinic_owner'
      and memberships.status = 'active'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.plans plans
    where plans.id = target_plan_id
      and plans.is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  select *
  into target_subscription
  from public.clinic_subscriptions subscriptions
  where subscriptions.clinic_id = target_clinic_id
  for update;

  if target_subscription.id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  if target_subscription.is_lifetime
    or target_subscription.status in ('blocked', 'cancelled', 'lifetime')
  then
    raise exception 'SUBSCRIPTION_NOT_SCHEDULABLE';
  end if;

  if target_subscription.scheduled_plan_id is not null then
    raise exception 'DOWNGRADE_ALREADY_SCHEDULED';
  end if;

  if exists (
    select 1
    from public.subscription_payment_submissions submissions
    where submissions.clinic_id = target_clinic_id
      and submissions.status = 'pending_review'
  ) then
    raise exception 'PAYMENT_NOTICE_PENDING';
  end if;

  target_effective_at := target_subscription.current_period_ends_at;
  if target_effective_at is null or target_effective_at <= now() then
    raise exception 'CURRENT_PERIOD_NOT_ACTIVE';
  end if;

  current_rank := case target_subscription.plan_id
    when 'basic' then 0
    when 'medium' then 1
    when 'pro' then 2
    else null
  end;
  requested_rank := case target_plan_id
    when 'basic' then 0
    when 'medium' then 1
    when 'pro' then 2
    else null
  end;

  if current_rank is null
    or requested_rank is null
    or requested_rank >= current_rank
  then
    raise exception 'INVALID_DOWNGRADE';
  end if;

  update public.clinic_subscriptions
  set
    scheduled_plan_id = target_plan_id,
    scheduled_plan_starts_at = target_effective_at,
    updated_at = now()
  where id = target_subscription.id;

  insert into public.subscription_events (
    clinic_id,
    subscription_id,
    event_type,
    previous_plan_id,
    new_plan_id,
    notes,
    metadata,
    recorded_by
  ) values (
    target_clinic_id,
    target_subscription.id,
    'downgrade_scheduled',
    target_subscription.plan_id,
    target_plan_id,
    'Downgrade solicitado por el propietario para el final del periodo.',
    jsonb_build_object(
      'effective_at', target_effective_at,
      'requested_by_owner', true
    ),
    target_recorded_by
  );

  return target_effective_at;
end;
$$;

revoke all on function public.schedule_subscription_downgrade(
  uuid,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.schedule_subscription_downgrade(
  uuid,
  text,
  uuid
) to service_role;

create or replace function public.cancel_scheduled_subscription_downgrade(
  target_clinic_id uuid,
  target_recorded_by uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subscription public.clinic_subscriptions%rowtype;
  cancelled_plan_id text;
begin
  if not exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.clinic_id = target_clinic_id
      and memberships.user_id = target_recorded_by
      and memberships.role = 'clinic_owner'
      and memberships.status = 'active'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select *
  into target_subscription
  from public.clinic_subscriptions subscriptions
  where subscriptions.clinic_id = target_clinic_id
  for update;

  if target_subscription.id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  cancelled_plan_id := target_subscription.scheduled_plan_id;
  if cancelled_plan_id is null then
    raise exception 'NO_SCHEDULED_DOWNGRADE';
  end if;

  update public.clinic_subscriptions
  set
    scheduled_plan_id = null,
    scheduled_plan_starts_at = null,
    updated_at = now()
  where id = target_subscription.id;

  insert into public.subscription_events (
    clinic_id,
    subscription_id,
    event_type,
    previous_plan_id,
    new_plan_id,
    notes,
    metadata,
    recorded_by
  ) values (
    target_clinic_id,
    target_subscription.id,
    'downgrade_cancelled',
    target_subscription.plan_id,
    cancelled_plan_id,
    'Downgrade programado cancelado por el propietario.',
    jsonb_build_object('requested_by_owner', true),
    target_recorded_by
  );

  return cancelled_plan_id;
end;
$$;

revoke all on function public.cancel_scheduled_subscription_downgrade(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.cancel_scheduled_subscription_downgrade(
  uuid,
  uuid
) to service_role;

create or replace function public.apply_admin_subscription_plan_change(
  target_clinic_id uuid,
  target_plan_id text,
  target_immediate boolean,
  target_reason text,
  target_recorded_by uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subscription public.clinic_subscriptions%rowtype;
  target_effective_at timestamptz;
  current_rank integer;
  requested_rank integer;
begin
  if not exists (
    select 1
    from public.profiles profiles
    where profiles.id = target_recorded_by
      and profiles.is_platform_admin = true
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.plans plans
    where plans.id = target_plan_id
      and plans.is_active = true
  ) then
    raise exception 'INVALID_PLAN';
  end if;

  select *
  into target_subscription
  from public.clinic_subscriptions subscriptions
  where subscriptions.clinic_id = target_clinic_id
  for update;

  if target_subscription.id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;
  if target_subscription.plan_id = target_plan_id then
    raise exception 'PLAN_UNCHANGED';
  end if;

  current_rank := case target_subscription.plan_id
    when 'basic' then 0
    when 'medium' then 1
    when 'pro' then 2
    else null
  end;
  requested_rank := case target_plan_id
    when 'basic' then 0
    when 'medium' then 1
    when 'pro' then 2
    else null
  end;

  if target_immediate then
    if length(btrim(coalesce(target_reason, ''))) < 5 then
      raise exception 'PLAN_CHANGE_REASON_INVALID';
    end if;

    target_effective_at := now();
    update public.clinic_subscriptions
    set
      plan_id = target_plan_id,
      scheduled_plan_id = null,
      scheduled_plan_starts_at = null,
      updated_at = now()
    where id = target_subscription.id;
  else
    if current_rank is null
      or requested_rank is null
      or requested_rank >= current_rank
    then
      raise exception 'INVALID_DOWNGRADE';
    end if;

    target_effective_at := target_subscription.current_period_ends_at;
    if target_effective_at is null or target_effective_at <= now() then
      raise exception 'CURRENT_PERIOD_NOT_ACTIVE';
    end if;

    update public.clinic_subscriptions
    set
      scheduled_plan_id = target_plan_id,
      scheduled_plan_starts_at = target_effective_at,
      updated_at = now()
    where id = target_subscription.id;
  end if;

  insert into public.subscription_events (
    clinic_id,
    subscription_id,
    event_type,
    previous_plan_id,
    new_plan_id,
    notes,
    metadata,
    recorded_by
  ) values (
    target_clinic_id,
    target_subscription.id,
    case when target_immediate
      then 'plan_changed'
      else 'downgrade_scheduled'
    end,
    target_subscription.plan_id,
    target_plan_id,
    nullif(btrim(target_reason), ''),
    jsonb_build_object(
      'effective_at', target_effective_at,
      'effective_mode', case when target_immediate
        then 'immediate_exception'
        else 'period_end'
      end
    ),
    target_recorded_by
  );

  return target_effective_at;
end;
$$;

revoke all on function public.apply_admin_subscription_plan_change(
  uuid,
  text,
  boolean,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.apply_admin_subscription_plan_change(
  uuid,
  text,
  boolean,
  text,
  uuid
) to service_role;
