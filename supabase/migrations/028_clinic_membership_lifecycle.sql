-- Reversible and auditable clinic membership access management.
-- Memberships are never physically deleted by this workflow.

create table if not exists public.clinic_membership_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  membership_id uuid not null references public.clinic_memberships(id) on delete restrict,
  target_user_id uuid not null,
  performed_by uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_status text not null,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint clinic_membership_events_action_allowed check (
    action in ('deactivated', 'reactivated')
  ),
  constraint clinic_membership_events_status_allowed check (
    previous_status in ('active', 'inactive')
    and new_status in ('active', 'inactive')
  ),
  constraint clinic_membership_events_reason_length check (
    char_length(btrim(reason)) between 5 and 500
  )
);

create index if not exists clinic_membership_events_clinic_created_idx
  on public.clinic_membership_events(clinic_id, created_at desc);

create index if not exists clinic_membership_events_membership_created_idx
  on public.clinic_membership_events(membership_id, created_at desc);

alter table public.clinic_membership_events enable row level security;

revoke all on public.clinic_membership_events from anon, authenticated;
grant select, insert on public.clinic_membership_events to service_role;

create or replace function public.update_clinic_membership_status(
  target_membership_id uuid,
  target_status text,
  target_reason text,
  target_updated_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.clinic_memberships%rowtype;
  actor_role text;
  allowed_limit integer;
  counted_members integer;
  normalized_reason text := btrim(coalesce(target_reason, ''));
  changed_at timestamptz := now();
  event_action text;
begin
  if target_membership_id is null
    or target_updated_by is null
    or target_status not in ('active', 'inactive') then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if char_length(normalized_reason) < 5
    or char_length(normalized_reason) > 500 then
    raise exception 'INVALID_REASON';
  end if;

  select memberships.*
  into target_membership
  from public.clinic_memberships memberships
  where memberships.id = target_membership_id
  for update;

  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_membership.clinic_id::text, 0)
  );

  select memberships.role
  into actor_role
  from public.clinic_memberships memberships
  where memberships.clinic_id = target_membership.clinic_id
    and memberships.user_id = target_updated_by
    and memberships.status = 'active'
    and memberships.role in ('clinic_owner', 'clinic_admin')
  limit 1;

  if actor_role is null then
    raise exception 'FORBIDDEN';
  end if;

  if target_membership.user_id = target_updated_by then
    raise exception 'SELF_ACTION_NOT_ALLOWED';
  end if;

  if target_membership.role = 'clinic_owner' then
    raise exception 'OWNER_PROTECTED';
  end if;

  if target_membership.status not in ('active', 'inactive')
    or target_membership.status = target_status then
    raise exception 'MEMBERSHIP_STATE_CONFLICT';
  end if;

  if target_status = 'active' then
    select least(
      plans.max_users,
      case subscriptions.plan_id
        when 'medium' then 4
        when 'pro' then 10
      end
    )
    into allowed_limit
    from public.clinic_subscriptions subscriptions
    join public.plans plans
      on plans.id = subscriptions.plan_id
      and plans.is_active = true
      and plans.can_manage_team = true
    where subscriptions.clinic_id = target_membership.clinic_id
      and subscriptions.status in ('trial', 'trialing', 'active')
      and subscriptions.plan_id in ('medium', 'pro');

    if allowed_limit is null then
      raise exception 'PLAN_NOT_ELIGIBLE';
    end if;

    select count(*)
    into counted_members
    from public.clinic_memberships memberships
    where memberships.clinic_id = target_membership.clinic_id
      and memberships.status in ('active', 'pending', 'pending_activation');

    if counted_members >= allowed_limit then
      raise exception 'MEMBER_LIMIT_REACHED';
    end if;
  end if;

  event_action :=
    case target_status
      when 'active' then 'reactivated'
      else 'deactivated'
    end;

  update public.clinic_memberships
  set
    status = target_status,
    activated_at = case
      when target_status = 'active' then coalesce(activated_at, changed_at)
      else activated_at
    end,
    updated_at = changed_at
  where id = target_membership.id;

  insert into public.clinic_membership_events (
    action,
    clinic_id,
    membership_id,
    new_status,
    performed_by,
    previous_status,
    reason,
    target_user_id
  )
  values (
    event_action,
    target_membership.clinic_id,
    target_membership.id,
    target_status,
    target_updated_by,
    target_membership.status,
    normalized_reason,
    target_membership.user_id
  );

  return jsonb_build_object(
    'clinicId', target_membership.clinic_id,
    'membershipId', target_membership.id,
    'status', target_status,
    'updatedAt', changed_at,
    'userId', target_membership.user_id
  );
end;
$$;

revoke all on function public.update_clinic_membership_status(
  uuid, text, text, uuid
) from public;
revoke all on function public.update_clinic_membership_status(
  uuid, text, text, uuid
) from anon;
revoke all on function public.update_clinic_membership_status(
  uuid, text, text, uuid
) from authenticated;
grant execute on function public.update_clinic_membership_status(
  uuid, text, text, uuid
) to service_role;

comment on table public.clinic_membership_events is
  'Immutable administrative audit trail for reversible clinic membership access changes.';

comment on function public.update_clinic_membership_status(
  uuid, text, text, uuid
) is
  'Atomically deactivates or reactivates non-owner clinic memberships with actor validation, plan limits and audit.';
