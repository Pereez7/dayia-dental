-- Allow safe voids when the only later subscription changes are extra-day grants.
-- The payment snapshot is restored first and the exact accumulated extension is
-- then reapplied. Plan, pricing, access and lifetime changes still block a void.

create or replace function public.void_manual_subscription_payment(
  target_payment_id uuid,
  target_voided_by uuid,
  target_void_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.subscription_payments%rowtype;
  target_subscription public.clinic_subscriptions%rowtype;
  latest_payment_id uuid;
  later_extra_days_events integer := 0;
  preserved_extra_interval interval := interval '0 days';
begin
  if length(btrim(coalesce(target_void_reason, ''))) < 5 then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select *
  into target_payment
  from public.subscription_payments
  where id = target_payment_id
  for update;

  if target_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if target_payment.status = 'voided' then
    raise exception 'PAYMENT_ALREADY_VOIDED';
  end if;

  select payments.id
  into latest_payment_id
  from public.subscription_payments payments
  where payments.clinic_id = target_payment.clinic_id
    and payments.status = 'registered'
  order by payments.paid_at desc, payments.created_at desc
  limit 1;

  if latest_payment_id is distinct from target_payment.id then
    raise exception 'ONLY_LATEST_PAYMENT_CAN_BE_VOIDED';
  end if;

  if exists (
    select 1
    from public.subscription_events events
    where events.subscription_id = target_payment.subscription_id
      and events.created_at > target_payment.created_at
      and events.event_type not in (
        'payment_registered',
        'payment_submission_rejected',
        'extra_days_granted'
      )
  ) then
    raise exception 'SUBSCRIPTION_CHANGED_AFTER_PAYMENT';
  end if;

  select count(*)
  into later_extra_days_events
  from public.subscription_events events
  where events.subscription_id = target_payment.subscription_id
    and events.created_at > target_payment.created_at
    and events.event_type = 'extra_days_granted';

  select *
  into target_subscription
  from public.clinic_subscriptions
  where clinic_id = target_payment.clinic_id
  for update;

  if later_extra_days_events > 0 then
    if target_payment.period_ends_at is null
      or target_subscription.current_period_ends_at is null
      or target_subscription.current_period_ends_at < target_payment.period_ends_at then
      raise exception 'EXTRA_DAYS_CANNOT_BE_PRESERVED';
    end if;

    preserved_extra_interval :=
      target_subscription.current_period_ends_at - target_payment.period_ends_at;

    if preserved_extra_interval <= interval '0 days' then
      raise exception 'EXTRA_DAYS_CANNOT_BE_PRESERVED';
    end if;
  end if;

  update public.subscription_payments
  set
    status = 'voided',
    voided_at = now(),
    voided_by = target_voided_by,
    void_reason = btrim(target_void_reason)
  where id = target_payment.id;

  if target_payment.subscription_snapshot is not null then
    target_subscription := jsonb_populate_record(
      target_subscription,
      target_payment.subscription_snapshot
    );

    update public.clinic_subscriptions
    set
      plan_id = target_subscription.plan_id,
      status = target_subscription.status,
      current_period_starts_at = target_subscription.current_period_starts_at,
      current_period_ends_at = target_subscription.current_period_ends_at,
      grace_ends_at = target_subscription.grace_ends_at,
      last_payment_at = target_subscription.last_payment_at,
      blocked_at = target_subscription.blocked_at,
      payment_status = target_subscription.payment_status,
      billing_cycle = target_subscription.billing_cycle,
      is_lifetime = target_subscription.is_lifetime,
      price_tier = target_subscription.price_tier,
      scheduled_plan_id = target_subscription.scheduled_plan_id,
      scheduled_plan_starts_at = target_subscription.scheduled_plan_starts_at,
      starts_at = target_subscription.starts_at,
      ends_at = target_subscription.ends_at,
      updated_at = now()
    where clinic_id = target_payment.clinic_id;
  else
    update public.clinic_subscriptions
    set
      plan_id = coalesce(target_payment.previous_plan_id, plan_id),
      status = case
        when trial_ends_at is not null and now() <= trial_ends_at
          then 'trialing'
        else 'past_due'
      end,
      current_period_starts_at = trial_starts_at,
      current_period_ends_at = trial_ends_at,
      grace_ends_at = case
        when trial_ends_at is null then null
        else trial_ends_at + interval '5 days'
      end,
      last_payment_at = null,
      payment_status = case
        when trial_ends_at is not null and now() <= trial_ends_at
          then 'trial'
        else 'past_due'
      end,
      billing_cycle = 'trial',
      is_lifetime = false,
      starts_at = coalesce(trial_starts_at, starts_at),
      ends_at = trial_ends_at,
      updated_at = now()
    where clinic_id = target_payment.clinic_id;
  end if;

  if later_extra_days_events > 0 then
    update public.clinic_subscriptions
    set
      status = 'active',
      current_period_ends_at =
        current_period_ends_at + preserved_extra_interval,
      grace_ends_at = coalesce(
        grace_ends_at + preserved_extra_interval,
        current_period_ends_at + preserved_extra_interval + interval '5 days'
      ),
      blocked_at = null,
      is_lifetime = false,
      ends_at = coalesce(
        ends_at,
        current_period_ends_at
      ) + preserved_extra_interval,
      updated_at = now()
    where clinic_id = target_payment.clinic_id;
  end if;

  update public.subscription_payment_submissions
  set
    status = 'cancelled',
    reviewed_at = now(),
    reviewed_by = target_voided_by,
    review_notes = 'El pago vinculado fue anulado.',
    updated_at = now()
  where linked_payment_id = target_payment.id
    and status = 'approved';

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
    target_payment.clinic_id,
    target_payment.subscription_id,
    'payment_voided',
    target_payment.new_plan_id,
    target_payment.previous_plan_id,
    btrim(target_void_reason),
    jsonb_build_object(
      'payment_id', target_payment.id,
      'preserved_extra_days',
      extract(epoch from preserved_extra_interval) / 86400,
      'preserved_extra_days_events', later_extra_days_events
    ),
    target_voided_by
  );

  return target_payment.id;
end;
$$;

revoke all on function public.void_manual_subscription_payment(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.void_manual_subscription_payment(
  uuid, uuid, text
) to service_role;

comment on function public.void_manual_subscription_payment(
  uuid, uuid, text
) is
  'Voids the latest payment, restores its snapshot and preserves later extra-day grants.';
