-- Auditable payment voids and owner-submitted payment notices.

alter table public.subscription_payments
  add column if not exists status text not null default 'registered',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists subscription_snapshot jsonb;

alter table public.subscription_payments
  drop constraint if exists subscription_payments_status_allowed,
  drop constraint if exists subscription_payments_void_fields_valid,
  drop constraint if exists subscription_payments_positive_paid_amount;

alter table public.subscription_payments
  add constraint subscription_payments_status_allowed check (
    status in ('registered', 'voided')
  ),
  add constraint subscription_payments_void_fields_valid check (
    (status = 'registered' and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'voided' and voided_at is not null and voided_by is not null and length(btrim(void_reason)) > 0)
  ),
  add constraint subscription_payments_positive_paid_amount check (
    amount_paid > 0
  ) not valid;

create index if not exists subscription_payments_active_paid_idx
  on public.subscription_payments (clinic_id, paid_at desc, created_at desc)
  where status = 'registered';

create table if not exists public.subscription_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  plan_id text not null references public.plans(id),
  billing_cycle text not null,
  amount_expected numeric(12, 2) not null,
  currency text not null default 'BOB',
  reference text not null,
  notes text,
  status text not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  linked_payment_id uuid references public.subscription_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payment_submissions_cycle_allowed check (
    billing_cycle in ('monthly', 'six_months', 'annual')
  ),
  constraint subscription_payment_submissions_amount_valid check (
    amount_expected > 0
  ),
  constraint subscription_payment_submissions_reference_required check (
    length(btrim(reference)) > 0
  ),
  constraint subscription_payment_submissions_status_allowed check (
    status in ('pending_review', 'approved', 'rejected', 'cancelled')
  ),
  constraint subscription_payment_submissions_review_valid check (
    (status = 'pending_review' and reviewed_at is null and reviewed_by is null)
    or status <> 'pending_review'
  )
);

create index if not exists subscription_payment_submissions_clinic_idx
  on public.subscription_payment_submissions (clinic_id, created_at desc);

create unique index if not exists subscription_payment_submissions_pending_reference_idx
  on public.subscription_payment_submissions (clinic_id, lower(reference))
  where status = 'pending_review';

alter table public.subscription_payment_submissions enable row level security;

revoke all on public.subscription_payment_submissions from anon, authenticated;
grant select, insert on public.subscription_payment_submissions to authenticated;
grant select, insert, update on public.subscription_payment_submissions to service_role;
grant select, insert, update on public.subscription_payments to service_role;

drop policy if exists subscription_payment_submissions_owner_select
  on public.subscription_payment_submissions;
create policy subscription_payment_submissions_owner_select
  on public.subscription_payment_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = subscription_payment_submissions.clinic_id
        and memberships.user_id = auth.uid()
        and memberships.role = 'clinic_owner'
        and memberships.status = 'active'
    )
  );

drop policy if exists subscription_payment_submissions_owner_insert
  on public.subscription_payment_submissions;
create policy subscription_payment_submissions_owner_insert
  on public.subscription_payment_submissions
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending_review'
    and reviewed_at is null
    and reviewed_by is null
    and linked_payment_id is null
    and exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = subscription_payment_submissions.clinic_id
        and memberships.user_id = auth.uid()
        and memberships.role = 'clinic_owner'
        and memberships.status = 'active'
    )
  );

alter table public.subscription_events
  drop constraint if exists subscription_events_type_allowed;
alter table public.subscription_events
  add constraint subscription_events_type_allowed check (
    event_type in (
      'plan_changed', 'payment_registered', 'payment_voided',
      'payment_submission_rejected', 'founder_enabled', 'founder_removed',
      'custom_price_set', 'extra_days_granted', 'blocked', 'reactivated',
      'lifetime_enabled', 'downgrade_scheduled', 'standard_price_restored',
      'cancelled'
    )
  );

drop function if exists public.record_manual_subscription_payment(
  uuid, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, timestamptz, timestamptz, timestamptz, timestamptz, uuid, boolean,
  text, text, text, text, boolean
);

create or replace function public.record_manual_subscription_payment(
  target_clinic_id uuid,
  target_plan_id text,
  target_billing_cycle text,
  target_months_covered integer,
  target_custom_days integer,
  target_amount_due numeric,
  target_discount_percent numeric,
  target_discount_amount numeric,
  target_amount_paid numeric,
  target_reference text,
  target_notes text,
  target_paid_at timestamptz,
  target_period_starts_at timestamptz,
  target_period_ends_at timestamptz,
  target_grace_ends_at timestamptz,
  target_recorded_by uuid,
  target_is_lifetime boolean,
  target_payment_type text,
  target_previous_plan_id text,
  target_new_plan_id text,
  target_price_tier text,
  target_preserve_period boolean default false,
  target_submission_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subscription public.clinic_subscriptions%rowtype;
  payment_id uuid;
begin
  if length(btrim(coalesce(target_reference, ''))) = 0 then
    raise exception 'PAYMENT_REFERENCE_REQUIRED';
  end if;

  if target_amount_paid <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;

  select * into target_subscription
  from public.clinic_subscriptions
  where clinic_id = target_clinic_id
  for update;

  if target_subscription.clinic_id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  if target_submission_id is not null and not exists (
    select 1 from public.subscription_payment_submissions submissions
    where submissions.id = target_submission_id
      and submissions.clinic_id = target_clinic_id
      and submissions.status = 'pending_review'
  ) then
    raise exception 'PAYMENT_SUBMISSION_NOT_AVAILABLE';
  end if;

  insert into public.subscription_payments (
    clinic_id, subscription_id, plan_id, billing_cycle, months_covered,
    custom_days, amount_due, discount_percent, discount_amount, amount_paid,
    currency, payment_method, qr_plan_id, reference, notes, paid_at,
    period_starts_at, period_ends_at, recorded_by, previous_plan_id,
    new_plan_id, payment_type, price_tier, subscription_snapshot
  ) values (
    target_clinic_id, target_subscription.id, target_plan_id,
    target_billing_cycle, target_months_covered, target_custom_days,
    target_amount_due, target_discount_percent, target_discount_amount,
    target_amount_paid,
    coalesce((select currency from public.plans where id = target_plan_id), 'BOB'),
    'qr', target_plan_id, btrim(target_reference),
    nullif(btrim(target_notes), ''), target_paid_at, target_period_starts_at,
    target_period_ends_at, target_recorded_by, target_previous_plan_id,
    target_new_plan_id, target_payment_type, target_price_tier,
    to_jsonb(target_subscription)
  ) returning id into payment_id;

  update public.clinic_subscriptions
  set
    plan_id = target_plan_id,
    status = case when target_is_lifetime then 'lifetime' else 'active' end,
    current_period_starts_at = case when target_preserve_period then current_period_starts_at else target_period_starts_at end,
    current_period_ends_at = case when target_preserve_period then current_period_ends_at when target_is_lifetime then null else target_period_ends_at end,
    grace_ends_at = case when target_preserve_period then grace_ends_at when target_is_lifetime then null else target_grace_ends_at end,
    last_payment_at = target_paid_at,
    blocked_at = null,
    payment_status = 'paid',
    billing_cycle = target_billing_cycle,
    is_lifetime = target_is_lifetime,
    price_tier = target_price_tier,
    scheduled_plan_id = null,
    scheduled_plan_starts_at = null,
    starts_at = case when target_preserve_period then starts_at else target_period_starts_at end,
    ends_at = case when target_preserve_period then ends_at when target_is_lifetime then null else target_period_ends_at end,
    updated_at = now()
  where clinic_id = target_clinic_id;

  if target_submission_id is not null then
    update public.subscription_payment_submissions
    set status = 'approved', reviewed_at = now(), reviewed_by = target_recorded_by,
        linked_payment_id = payment_id, updated_at = now()
    where id = target_submission_id;
  end if;

  insert into public.subscription_events (
    clinic_id, subscription_id, event_type, previous_plan_id, new_plan_id,
    notes, metadata, recorded_by
  ) values (
    target_clinic_id, target_subscription.id, 'payment_registered',
    target_previous_plan_id, target_new_plan_id, nullif(btrim(target_notes), ''),
    jsonb_build_object(
      'payment_id', payment_id,
      'payment_type', target_payment_type,
      'submission_id', target_submission_id
    ),
    target_recorded_by
  );

  return payment_id;
end;
$$;

revoke all on function public.record_manual_subscription_payment(
  uuid, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, timestamptz, timestamptz, timestamptz, timestamptz, uuid, boolean,
  text, text, text, text, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.record_manual_subscription_payment(
  uuid, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, timestamptz, timestamptz, timestamptz, timestamptz, uuid, boolean,
  text, text, text, text, boolean, uuid
) to service_role;

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
begin
  if length(btrim(coalesce(target_void_reason, ''))) < 5 then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select * into target_payment
  from public.subscription_payments
  where id = target_payment_id
  for update;

  if target_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if target_payment.status = 'voided' then
    raise exception 'PAYMENT_ALREADY_VOIDED';
  end if;

  select id into latest_payment_id
  from public.subscription_payments
  where clinic_id = target_payment.clinic_id and status = 'registered'
  order by paid_at desc, created_at desc
  limit 1;

  if latest_payment_id is distinct from target_payment.id then
    raise exception 'ONLY_LATEST_PAYMENT_CAN_BE_VOIDED';
  end if;

  if exists (
    select 1
    from public.subscription_events events
    where events.subscription_id = target_payment.subscription_id
      and events.created_at > target_payment.created_at
      and events.event_type <> 'payment_registered'
  ) then
    raise exception 'SUBSCRIPTION_CHANGED_AFTER_PAYMENT';
  end if;

  select * into target_subscription
  from public.clinic_subscriptions
  where clinic_id = target_payment.clinic_id
  for update;

  update public.subscription_payments
  set status = 'voided', voided_at = now(), voided_by = target_voided_by,
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
      status = case when trial_ends_at is not null and now() <= trial_ends_at then 'trialing' else 'past_due' end,
      current_period_starts_at = trial_starts_at,
      current_period_ends_at = trial_ends_at,
      grace_ends_at = case when trial_ends_at is null then null else trial_ends_at + interval '5 days' end,
      last_payment_at = null,
      payment_status = case when trial_ends_at is not null and now() <= trial_ends_at then 'trial' else 'past_due' end,
      billing_cycle = 'trial',
      is_lifetime = false,
      starts_at = coalesce(trial_starts_at, starts_at),
      ends_at = trial_ends_at,
      updated_at = now()
    where clinic_id = target_payment.clinic_id;
  end if;

  update public.subscription_payment_submissions
  set status = 'cancelled', reviewed_at = now(), reviewed_by = target_voided_by,
      review_notes = 'El pago vinculado fue anulado.',
      updated_at = now()
  where linked_payment_id = target_payment.id and status = 'approved';

  insert into public.subscription_events (
    clinic_id, subscription_id, event_type, previous_plan_id, new_plan_id,
    notes, metadata, recorded_by
  ) values (
    target_payment.clinic_id, target_payment.subscription_id,
    'payment_voided', target_payment.new_plan_id, target_payment.previous_plan_id,
    btrim(target_void_reason), jsonb_build_object('payment_id', target_payment.id),
    target_voided_by
  );

  return target_payment.id;
end;
$$;

revoke all on function public.void_manual_subscription_payment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.void_manual_subscription_payment(uuid, uuid, text)
  to service_role;

comment on table public.subscription_payment_submissions is
  'Owner-submitted QR payment notices pending explicit platform validation.';
comment on column public.subscription_payments.subscription_snapshot is
  'Subscription state immediately before this payment, used for safe latest-payment voids.';
