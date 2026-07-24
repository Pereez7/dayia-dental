-- Reversible and auditable administrative lifetime memberships.
-- Payment-backed lifetime access continues to be reversed by voiding its payment.

alter table public.clinic_subscriptions
  add column if not exists lifetime_previous_state jsonb,
  add column if not exists lifetime_enabled_at timestamptz,
  add column if not exists lifetime_enabled_by uuid
    references public.profiles(id) on delete set null;

alter table public.subscription_events
  drop constraint if exists subscription_events_type_allowed;
alter table public.subscription_events
  add constraint subscription_events_type_allowed check (
    event_type in (
      'plan_changed', 'payment_registered', 'payment_voided',
      'payment_submission_rejected', 'founder_enabled', 'founder_removed',
      'custom_price_set', 'extra_days_granted', 'blocked', 'reactivated',
      'lifetime_enabled', 'lifetime_disabled', 'downgrade_scheduled',
      'standard_price_restored', 'cancelled'
    )
  );

create or replace function public.set_subscription_lifetime_membership(
  target_clinic_id uuid,
  target_enabled boolean,
  target_reason text,
  target_updated_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subscription public.clinic_subscriptions%rowtype;
  previous_state jsonb;
  restored_subscription public.clinic_subscriptions%rowtype;
  restored_status text;
begin
  if length(btrim(coalesce(target_reason, ''))) < 5
    or length(btrim(target_reason)) > 500 then
    raise exception 'LIFETIME_REASON_INVALID';
  end if;

  select *
  into target_subscription
  from public.clinic_subscriptions
  where clinic_id = target_clinic_id
  for update;

  if target_subscription.id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  if target_enabled then
    if target_subscription.is_lifetime
      or target_subscription.status = 'lifetime' then
      raise exception 'LIFETIME_ALREADY_ENABLED';
    end if;

    previous_state := jsonb_build_object(
      'status', target_subscription.status,
      'current_period_starts_at', target_subscription.current_period_starts_at,
      'current_period_ends_at', target_subscription.current_period_ends_at,
      'grace_ends_at', target_subscription.grace_ends_at,
      'last_payment_at', target_subscription.last_payment_at,
      'blocked_at', target_subscription.blocked_at,
      'payment_status', target_subscription.payment_status,
      'billing_cycle', target_subscription.billing_cycle,
      'is_lifetime', target_subscription.is_lifetime,
      'starts_at', target_subscription.starts_at,
      'ends_at', target_subscription.ends_at
    );

    update public.clinic_subscriptions
    set
      status = 'lifetime',
      current_period_ends_at = null,
      grace_ends_at = null,
      blocked_at = null,
      payment_status = 'paid',
      billing_cycle = 'lifetime',
      is_lifetime = true,
      ends_at = null,
      lifetime_previous_state = previous_state,
      lifetime_enabled_at = now(),
      lifetime_enabled_by = target_updated_by,
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
      'lifetime_enabled',
      target_subscription.plan_id,
      target_subscription.plan_id,
      btrim(target_reason),
      jsonb_build_object(
        'mode', 'administrative_grant',
        'previous_status', target_subscription.status,
        'previous_period_ends_at', target_subscription.current_period_ends_at
      ),
      target_updated_by
    );
  else
    if not target_subscription.is_lifetime
      and target_subscription.status <> 'lifetime' then
      raise exception 'LIFETIME_NOT_ENABLED';
    end if;

    if exists (
      select 1
      from public.subscription_payments payments
      where payments.subscription_id = target_subscription.id
        and payments.status = 'registered'
        and payments.billing_cycle = 'lifetime'
    ) then
      raise exception 'LIFETIME_PAYMENT_REQUIRES_VOID';
    end if;

    previous_state := target_subscription.lifetime_previous_state;

    if previous_state is null then
      raise exception 'LIFETIME_RESTORE_STATE_MISSING';
    end if;

    restored_subscription := jsonb_populate_record(
      target_subscription,
      previous_state
    );

    restored_status := restored_subscription.status;

    if restored_status not in ('blocked', 'cancelled') then
      if restored_subscription.current_period_ends_at is not null
        and now() > restored_subscription.current_period_ends_at then
        restored_status := 'past_due';
      elsif restored_status = 'lifetime' then
        restored_status := 'active';
      end if;
    end if;

    update public.clinic_subscriptions
    set
      status = restored_status,
      current_period_starts_at =
        restored_subscription.current_period_starts_at,
      current_period_ends_at = restored_subscription.current_period_ends_at,
      grace_ends_at = restored_subscription.grace_ends_at,
      last_payment_at = restored_subscription.last_payment_at,
      blocked_at = restored_subscription.blocked_at,
      payment_status = restored_subscription.payment_status,
      billing_cycle = restored_subscription.billing_cycle,
      is_lifetime = false,
      starts_at = restored_subscription.starts_at,
      ends_at = restored_subscription.ends_at,
      lifetime_previous_state = null,
      lifetime_enabled_at = null,
      lifetime_enabled_by = null,
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
      'lifetime_disabled',
      target_subscription.plan_id,
      target_subscription.plan_id,
      btrim(target_reason),
      jsonb_build_object(
        'mode', 'administrative_grant',
        'restored_status', restored_status,
        'restored_period_ends_at',
        restored_subscription.current_period_ends_at,
        'restored_grace_ends_at', restored_subscription.grace_ends_at
      ),
      target_updated_by
    );
  end if;

  return (
    select jsonb_build_object(
      'clinicId', subscriptions.clinic_id,
      'enabled', subscriptions.is_lifetime,
      'status', subscriptions.status,
      'currentPeriodEndsAt', subscriptions.current_period_ends_at,
      'graceEndsAt', subscriptions.grace_ends_at
    )
    from public.clinic_subscriptions subscriptions
    where subscriptions.id = target_subscription.id
  );
end;
$$;

revoke all on function public.set_subscription_lifetime_membership(
  uuid, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.set_subscription_lifetime_membership(
  uuid, boolean, text, uuid
) to service_role;

comment on function public.set_subscription_lifetime_membership(
  uuid, boolean, text, uuid
) is
  'Enables or disables an administrative lifetime membership and restores its prior access state.';
