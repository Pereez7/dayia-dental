-- Extends the existing activation RPC to invited clinic members.
-- Clinic activation remains restricted to clinic_owner memberships.

create or replace function public.complete_account_activation(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  activated_at_value timestamptz := now();
  pending_clinic_ids uuid[];
  owner_clinic_ids uuid[];
begin
  if target_user_id is null then
    raise exception 'A user id is required.';
  end if;

  select array_agg(memberships.clinic_id order by memberships.created_at)
  into pending_clinic_ids
  from public.clinic_memberships memberships
  where memberships.user_id = target_user_id
    and memberships.status in ('pending', 'pending_activation', 'active');

  if coalesce(array_length(pending_clinic_ids, 1), 0) = 0 then
    raise exception 'No clinic membership is available for activation.';
  end if;

  select array_agg(memberships.clinic_id order by memberships.created_at)
  into owner_clinic_ids
  from public.clinic_memberships memberships
  where memberships.user_id = target_user_id
    and memberships.role = 'clinic_owner'
    and memberships.status in ('pending', 'pending_activation', 'active');

  update public.profiles
  set
    activated_at = coalesce(activated_at, activated_at_value),
    is_active = true,
    updated_at = activated_at_value
  where id = target_user_id;

  if not found then
    raise exception 'The member profile was not found.';
  end if;

  update public.clinic_memberships
  set
    status = 'active',
    activated_at = coalesce(activated_at, activated_at_value),
    updated_at = activated_at_value
  where user_id = target_user_id
    and status in ('pending', 'pending_activation');

  if coalesce(array_length(owner_clinic_ids, 1), 0) > 0 then
    update public.clinics
    set
      status = 'active',
      updated_at = activated_at_value
    where id = any(owner_clinic_ids)
      and status = 'pending_activation';
  end if;

  return jsonb_build_object(
    'clinicIds', to_jsonb(pending_clinic_ids),
    'status', 'active'
  );
end;
$$;

revoke all on function public.complete_account_activation(uuid) from public;
revoke all on function public.complete_account_activation(uuid) from anon;
revoke all on function public.complete_account_activation(uuid) from authenticated;
grant execute on function public.complete_account_activation(uuid) to service_role;

comment on function public.complete_account_activation(uuid) is
  'Activates pending clinic memberships for the authenticated user. Pending clinics are activated only for clinic owners.';
