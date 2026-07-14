-- Serializes clinic membership inserts so concurrent invitations cannot exceed
-- the Medium/Pro member limit. Only the trusted Edge Function can execute it.

create or replace function public.insert_clinic_membership_with_limit(
  target_clinic_id uuid,
  target_user_id uuid,
  target_role text,
  target_status text,
  target_invited_at timestamptz,
  target_activated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_limit integer;
  current_member_count integer;
  created_membership_id uuid;
begin
  if target_clinic_id is null or target_user_id is null then
    raise exception 'INVALID_MEMBERSHIP';
  end if;

  if target_role not in ('clinic_admin', 'doctor', 'receptionist') then
    raise exception 'INVALID_ROLE';
  end if;

  if target_status not in ('active', 'pending_activation') then
    raise exception 'INVALID_MEMBERSHIP_STATUS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_clinic_id::text, 0));

  if exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.clinic_id = target_clinic_id
      and memberships.user_id = target_user_id
  ) then
    raise exception 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

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
  where subscriptions.clinic_id = target_clinic_id
    and subscriptions.status in ('trial', 'active')
    and subscriptions.plan_id in ('medium', 'pro');

  if allowed_limit is null then
    raise exception 'PLAN_NOT_ELIGIBLE';
  end if;

  select count(*)
  into current_member_count
  from public.clinic_memberships memberships
  where memberships.clinic_id = target_clinic_id
    and memberships.status in ('active', 'pending', 'pending_activation');

  if current_member_count >= allowed_limit then
    raise exception 'MEMBER_LIMIT_REACHED';
  end if;

  insert into public.clinic_memberships (
    activated_at,
    clinic_id,
    invited_at,
    role,
    status,
    user_id
  )
  values (
    target_activated_at,
    target_clinic_id,
    target_invited_at,
    target_role,
    target_status,
    target_user_id
  )
  returning id into created_membership_id;

  return created_membership_id;
end;
$$;

revoke all on function public.insert_clinic_membership_with_limit(
  uuid, uuid, text, text, timestamptz, timestamptz
) from public;
revoke all on function public.insert_clinic_membership_with_limit(
  uuid, uuid, text, text, timestamptz, timestamptz
) from anon;
revoke all on function public.insert_clinic_membership_with_limit(
  uuid, uuid, text, text, timestamptz, timestamptz
) from authenticated;
grant execute on function public.insert_clinic_membership_with_limit(
  uuid, uuid, text, text, timestamptz, timestamptz
) to service_role;

comment on function public.insert_clinic_membership_with_limit(
  uuid, uuid, text, text, timestamptz, timestamptz
) is
  'Atomically inserts an invited clinic member while enforcing Medium/Pro limits. Callable only by service_role after Edge Function authorization.';
