-- Memberships, plans and subscriptions foundation.
-- This migration is additive and keeps profiles.clinic_id as legacy fallback.
-- It does not delete users, profiles or clinical data.

create table if not exists public.plans (
  id text primary key,
  name text not null,
  max_users integer not null,
  can_manage_team boolean not null default false,
  can_use_whatsapp_automation boolean not null default false,
  can_use_advanced_reports boolean not null default false,
  is_active boolean not null default true,
  constraint plans_max_users_positive check (max_users > 0)
);

create table if not exists public.clinic_subscriptions (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_subscriptions_status_allowed check (
    status in ('trial', 'active', 'past_due', 'cancelled', 'suspended')
  )
);

create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_memberships_clinic_user_unique unique (clinic_id, user_id),
  constraint clinic_memberships_role_allowed check (
    role in ('clinic_owner', 'clinic_admin', 'doctor', 'receptionist')
  ),
  constraint clinic_memberships_status_allowed check (
    status in ('pending', 'active', 'inactive')
  )
);

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.clinic_id is
  'Legacy single-clinic link. New multi-clinic authorization should use public.clinic_memberships.';

comment on column public.profiles.role is
  'Legacy clinical role kept for compatibility. New clinic roles live in public.clinic_memberships.role. Platform admins use profiles.is_platform_admin.';

comment on column public.profiles.is_platform_admin is
  'Internal DayIA Dental platform administrator flag. This is not a clinic role.';

create index if not exists clinic_memberships_user_status_idx
  on public.clinic_memberships (user_id, status);

create index if not exists clinic_memberships_clinic_status_role_idx
  on public.clinic_memberships (clinic_id, status, role);

create index if not exists clinic_subscriptions_plan_status_idx
  on public.clinic_subscriptions (plan_id, status);

insert into public.plans (
  id,
  name,
  max_users,
  can_manage_team,
  can_use_whatsapp_automation,
  can_use_advanced_reports,
  is_active
)
values
  ('basic', 'Basic', 1, false, false, false, true),
  ('medium', 'Medium', 4, true, false, false, true),
  ('pro', 'Pro', 10, true, true, true, true)
on conflict (id) do update
set
  name = excluded.name,
  max_users = excluded.max_users,
  can_manage_team = excluded.can_manage_team,
  can_use_whatsapp_automation = excluded.can_use_whatsapp_automation,
  can_use_advanced_reports = excluded.can_use_advanced_reports,
  is_active = excluded.is_active;

insert into public.clinic_memberships (
  clinic_id,
  user_id,
  role,
  status,
  invited_at,
  activated_at,
  created_at,
  updated_at
)
select
  profiles.clinic_id,
  profiles.id,
  case
    when profiles.role in ('clinic_admin', 'super_admin', 'admin', 'owner') then 'clinic_owner'
    when profiles.role in ('doctor', 'dentist') then 'doctor'
    when profiles.role in ('receptionist', 'reception') then 'receptionist'
    else 'clinic_owner'
  end,
  'active',
  null::timestamptz,
  coalesce(profiles.created_at, now()),
  coalesce(profiles.created_at, now()),
  now()
from public.profiles
where profiles.clinic_id is not null
on conflict (clinic_id, user_id) do update
set
  role = excluded.role,
  status = excluded.status,
  activated_at = coalesce(public.clinic_memberships.activated_at, excluded.activated_at),
  updated_at = now();

insert into public.clinic_subscriptions (
  clinic_id,
  plan_id,
  status,
  starts_at,
  created_at,
  updated_at
)
select
  clinics.id,
  case
    when count(clinic_memberships.user_id) > 1 then 'medium'
    else 'basic'
  end,
  'active',
  now(),
  now(),
  now()
from public.clinics
left join public.clinic_memberships
  on clinic_memberships.clinic_id = clinics.id
  and clinic_memberships.status = 'active'
group by clinics.id
on conflict (clinic_id) do update
set
  plan_id = excluded.plan_id,
  status = excluded.status,
  updated_at = now();

create or replace function public.current_user_active_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select memberships.clinic_id
  from public.clinic_memberships memberships
  where memberships.user_id = auth.uid()
    and memberships.status = 'active'
  order by memberships.created_at asc
  limit 1
$$;

create or replace function public.current_user_clinic_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select memberships.role
  from public.clinic_memberships memberships
  where memberships.user_id = auth.uid()
    and memberships.status = 'active'
    and memberships.clinic_id = public.current_user_active_clinic_id()
  limit 1
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
    and subscriptions.status in ('trial', 'active')
  limit 1
$$;

create or replace function public.can_manage_team()
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
      and subscriptions.status in ('trial', 'active')
    join public.plans plans
      on plans.id = subscriptions.plan_id
      and plans.is_active = true
    where memberships.user_id = auth.uid()
      and memberships.status = 'active'
      and memberships.role in ('clinic_owner', 'clinic_admin')
      and memberships.clinic_id = public.current_user_active_clinic_id()
      and plans.can_manage_team = true
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
      and subscriptions.status in ('trial', 'active')
    join public.plans plans
      on plans.id = subscriptions.plan_id
      and plans.is_active = true
    where memberships.user_id = auth.uid()
      and memberships.clinic_id = target_clinic_id
      and memberships.status = 'active'
      and memberships.role in ('clinic_owner', 'clinic_admin')
      and plans.can_manage_team = true
  )
$$;

revoke all on function public.current_user_active_clinic_id() from public;
revoke all on function public.current_user_clinic_role() from public;
revoke all on function public.current_clinic_plan() from public;
revoke all on function public.can_manage_team() from public;
revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.can_manage_team_for_clinic(uuid) from public;

grant execute on function public.current_user_active_clinic_id() to authenticated;
grant execute on function public.current_user_clinic_role() to authenticated;
grant execute on function public.current_clinic_plan() to authenticated;
grant execute on function public.can_manage_team() to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.can_manage_team_for_clinic(uuid) to authenticated;

alter table public.clinic_memberships enable row level security;
alter table public.plans enable row level security;
alter table public.clinic_subscriptions enable row level security;

grant select on public.plans to authenticated;
grant select on public.clinic_memberships to authenticated;
grant select on public.clinic_subscriptions to authenticated;

grant usage on schema public to service_role;
grant select, insert, update on public.clinic_memberships to service_role;
grant select, insert, update on public.clinic_subscriptions to service_role;
grant select on public.plans to service_role;

drop policy if exists "members can read own memberships" on public.clinic_memberships;
create policy "members can read own memberships"
  on public.clinic_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "team managers can read clinic memberships" on public.clinic_memberships;
create policy "team managers can read clinic memberships"
  on public.clinic_memberships
  for select
  to authenticated
  using (public.can_manage_team_for_clinic(clinic_id));

drop policy if exists "authenticated users can read active plans" on public.plans;
create policy "authenticated users can read active plans"
  on public.plans
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "active members can read clinic subscription" on public.clinic_subscriptions;
create policy "active members can read clinic subscription"
  on public.clinic_subscriptions
  for select
  to authenticated
  using (public.is_active_member(clinic_id));

comment on table public.clinic_memberships is
  'Clinic membership and role model. This replaces profiles.clinic_id for new multi-clinic authorization.';

comment on table public.plans is
  'Internal DayIA Dental plan capability catalog.';

comment on table public.clinic_subscriptions is
  'Current plan subscription per clinic. Billing integration will be added later.';
