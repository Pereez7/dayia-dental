-- Manual subscription billing foundation.
-- Additive only: it never deletes clinics, users or clinical records.

alter table public.plans
  add column if not exists monthly_price numeric(12, 2),
  add column if not exists currency text not null default 'BOB';

alter table public.plans
  drop constraint if exists plans_monthly_price_non_negative;

alter table public.plans
  add constraint plans_monthly_price_non_negative check (
    monthly_price is null or monthly_price >= 0
  );

alter table public.clinic_subscriptions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_starts_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists blocked_at timestamptz,
  add column if not exists payment_status text,
  add column if not exists billing_cycle text,
  add column if not exists is_lifetime boolean not null default false;

update public.clinic_subscriptions
set id = gen_random_uuid()
where id is null;

alter table public.clinic_subscriptions
  alter column id set not null;

create unique index if not exists clinic_subscriptions_id_unique_idx
  on public.clinic_subscriptions (id);

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_status_allowed;

update public.clinic_subscriptions
set status = case
  when status = 'trial' then 'trialing'
  when status = 'suspended' then 'blocked'
  else status
end
where status in ('trial', 'suspended');

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_status_allowed check (
    status in ('trialing', 'active', 'past_due', 'blocked', 'cancelled', 'lifetime')
  );

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_payment_status_allowed;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_payment_status_allowed check (
    payment_status is null or payment_status in ('trial', 'paid', 'past_due', 'cancelled')
  );

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_billing_cycle_allowed;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_billing_cycle_allowed check (
    billing_cycle is null or billing_cycle in ('trial', 'monthly', 'six_months', 'annual', 'custom_days', 'lifetime')
  );

update public.clinic_subscriptions
set
  current_period_starts_at = coalesce(current_period_starts_at, starts_at),
  current_period_ends_at = coalesce(current_period_ends_at, ends_at),
  grace_ends_at = coalesce(
    grace_ends_at,
    coalesce(current_period_ends_at, ends_at) + interval '5 days'
  ),
  payment_status = coalesce(
    payment_status,
    case when status = 'trialing' then 'trial' else 'paid' end
  ),
  billing_cycle = coalesce(
    billing_cycle,
    case when status = 'trialing' then 'trial' else 'monthly' end
  ),
  is_lifetime = status = 'lifetime' or is_lifetime,
  updated_at = now();

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  subscription_id uuid references public.clinic_subscriptions(id) on delete set null,
  plan_id text not null references public.plans(id),
  billing_cycle text not null,
  months_covered integer,
  custom_days integer,
  amount_due numeric(12, 2) not null,
  discount_percent numeric(5, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null,
  currency text not null default 'BOB',
  payment_method text not null default 'qr',
  qr_plan_id text,
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscription_payments_cycle_allowed check (
    billing_cycle in ('monthly', 'six_months', 'annual', 'custom_days', 'lifetime')
  ),
  constraint subscription_payments_amounts_valid check (
    amount_due >= 0 and amount_paid >= 0 and discount_amount >= 0
  ),
  constraint subscription_payments_discount_valid check (
    discount_percent between 0 and 100
  ),
  constraint subscription_payments_period_valid check (
    (billing_cycle = 'lifetime' and period_ends_at is null)
    or billing_cycle <> 'lifetime'
  )
);

create table if not exists public.plan_billing_options (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  billing_cycle text not null,
  months integer,
  discount_percent numeric(5, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_billing_options_unique unique (plan_id, billing_cycle),
  constraint plan_billing_options_cycle_allowed check (
    billing_cycle in ('monthly', 'six_months', 'annual', 'custom_days', 'lifetime')
  ),
  constraint plan_billing_options_discount_valid check (
    discount_percent between 0 and 100
  )
);

insert into public.plan_billing_options (
  plan_id,
  billing_cycle,
  months,
  discount_percent,
  sort_order
)
select plans.id, options.billing_cycle, options.months, options.discount, options.sort_order
from public.plans
cross join (
  values
    ('monthly', 1, 0::numeric, 10),
    ('six_months', 6, 10::numeric, 20),
    ('annual', 12, 20::numeric, 30),
    ('custom_days', null, 0::numeric, 40),
    ('lifetime', null, 0::numeric, 50)
) as options(billing_cycle, months, discount, sort_order)
on conflict (plan_id, billing_cycle) do nothing;

create index if not exists subscription_payments_clinic_paid_idx
  on public.subscription_payments (clinic_id, paid_at desc);

create index if not exists subscription_payments_subscription_idx
  on public.subscription_payments (subscription_id);

alter table public.subscription_payments enable row level security;
alter table public.plan_billing_options enable row level security;

revoke all on public.subscription_payments from anon, authenticated;
revoke all on public.plan_billing_options from anon, authenticated;
grant select, insert on public.subscription_payments to service_role;
grant select on public.plan_billing_options to service_role;
grant select, update on public.clinic_subscriptions to service_role;
grant select, update on public.plans to service_role;

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
  target_is_lifetime boolean
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
  select * into target_subscription
  from public.clinic_subscriptions
  where clinic_id = target_clinic_id
  for update;

  if target_subscription.clinic_id is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND';
  end if;

  insert into public.subscription_payments (
    clinic_id,
    subscription_id,
    plan_id,
    billing_cycle,
    months_covered,
    custom_days,
    amount_due,
    discount_percent,
    discount_amount,
    amount_paid,
    currency,
    payment_method,
    qr_plan_id,
    reference,
    notes,
    paid_at,
    period_starts_at,
    period_ends_at,
    recorded_by
  ) values (
    target_clinic_id,
    target_subscription.id,
    target_plan_id,
    target_billing_cycle,
    target_months_covered,
    target_custom_days,
    target_amount_due,
    target_discount_percent,
    target_discount_amount,
    target_amount_paid,
    coalesce((select currency from public.plans where id = target_plan_id), 'BOB'),
    'qr',
    target_plan_id,
    nullif(btrim(target_reference), ''),
    nullif(btrim(target_notes), ''),
    target_paid_at,
    target_period_starts_at,
    target_period_ends_at,
    target_recorded_by
  ) returning id into payment_id;

  update public.clinic_subscriptions
  set
    plan_id = target_plan_id,
    status = case when target_is_lifetime then 'lifetime' else 'active' end,
    current_period_starts_at = target_period_starts_at,
    current_period_ends_at = case when target_is_lifetime then null else target_period_ends_at end,
    grace_ends_at = case when target_is_lifetime then null else target_grace_ends_at end,
    last_payment_at = target_paid_at,
    blocked_at = null,
    payment_status = 'paid',
    billing_cycle = target_billing_cycle,
    is_lifetime = target_is_lifetime,
    starts_at = target_period_starts_at,
    ends_at = case when target_is_lifetime then null else target_period_ends_at end,
    updated_at = now()
  where clinic_id = target_clinic_id;

  return payment_id;
end;
$$;

revoke all on function public.record_manual_subscription_payment(
  uuid, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, timestamptz, timestamptz, timestamptz, timestamptz, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.record_manual_subscription_payment(
  uuid, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, timestamptz, timestamptz, timestamptz, timestamptz, uuid, boolean
) to service_role;

comment on column public.plans.monthly_price is
  'Manual monthly price in plans.currency. Configure before registering calculated QR payments.';
comment on table public.subscription_payments is
  'Immutable manual payment ledger. Only trusted Edge Functions may insert rows.';
comment on table public.plan_billing_options is
  'Suggested billing cycles and discounts for manual platform billing.';

create or replace function public.subscription_allows_clinical_access(
  target_clinic_id uuid,
  reference_time timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_subscriptions subscriptions
    where subscriptions.clinic_id = target_clinic_id
      and subscriptions.status not in ('blocked', 'cancelled')
      and (
        subscriptions.status = 'lifetime'
        or subscriptions.is_lifetime = true
        or (
          subscriptions.status in ('trialing', 'active', 'past_due')
          and (
            subscriptions.current_period_ends_at is null
            or reference_time <= coalesce(
              subscriptions.grace_ends_at,
              subscriptions.current_period_ends_at
            )
          )
        )
      )
  )
$$;

create or replace function public.is_active_member(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.user_id = auth.uid()
      and memberships.clinic_id = target_clinic_id
      and memberships.status = 'active'
  )
$$;

create or replace function public.current_clinic_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select subscriptions.plan_id
  from public.clinic_subscriptions subscriptions
  where subscriptions.clinic_id = public.current_user_active_clinic_id()
  limit 1
$$;

create or replace function public.can_manage_team_for_clinic(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships memberships
    join public.clinic_subscriptions subscriptions
      on subscriptions.clinic_id = memberships.clinic_id
    join public.plans plans
      on plans.id = subscriptions.plan_id
      and plans.is_active = true
    where memberships.user_id = auth.uid()
      and memberships.clinic_id = target_clinic_id
      and memberships.status = 'active'
      and memberships.role in ('clinic_owner', 'clinic_admin')
      and public.subscription_allows_clinical_access(target_clinic_id)
      and plans.can_manage_team = true
  )
$$;

create or replace function public.can_manage_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_team_for_clinic(public.current_user_active_clinic_id())
$$;

revoke all on function public.subscription_allows_clinical_access(uuid, timestamptz)
  from public;
grant execute on function public.subscription_allows_clinical_access(uuid, timestamptz)
  to authenticated, service_role;
