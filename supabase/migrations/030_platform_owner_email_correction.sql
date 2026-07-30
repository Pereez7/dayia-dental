-- Audited replacement of a clinic owner before the clinic is activated.
-- The workflow is service-role only and never mutates the email of an
-- existing Auth identity that may belong to another clinic.

create table if not exists public.platform_clinic_owner_corrections (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  previous_owner_user_id uuid not null,
  replacement_owner_user_id uuid not null,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_owner_correction_distinct_users check (
    previous_owner_user_id <> replacement_owner_user_id
  )
);

create index if not exists platform_owner_corrections_clinic_created_idx
  on public.platform_clinic_owner_corrections(clinic_id, created_at desc);

alter table public.platform_clinic_owner_corrections enable row level security;

revoke all on public.platform_clinic_owner_corrections
  from public, anon, authenticated;
grant select, insert on public.platform_clinic_owner_corrections
  to service_role;

create or replace function public.replace_pending_platform_clinic_owner(
  target_clinic_id uuid,
  expected_owner_user_id uuid,
  replacement_owner_user_id uuid,
  target_performed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_membership public.clinic_memberships%rowtype;
  replacement_membership_id uuid;
  changed_at timestamptz := now();
begin
  if target_clinic_id is null
    or expected_owner_user_id is null
    or replacement_owner_user_id is null
    or target_performed_by is null
    or expected_owner_user_id = replacement_owner_user_id then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1
    from public.profiles profiles
    where profiles.id = target_performed_by
      and profiles.is_platform_admin = true
  ) then
    raise exception 'FORBIDDEN';
  end if;

  perform 1
  from public.clinics clinics
  where clinics.id = target_clinic_id
    and clinics.status = 'pending_activation'
  for update;

  if not found then
    raise exception 'CLINIC_NOT_PENDING';
  end if;

  select memberships.*
  into current_membership
  from public.clinic_memberships memberships
  where memberships.clinic_id = target_clinic_id
    and memberships.user_id = expected_owner_user_id
    and memberships.role = 'clinic_owner'
    and memberships.status in ('active', 'pending_activation')
  order by memberships.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'OWNER_MEMBERSHIP_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.user_id = replacement_owner_user_id
      and memberships.status in (
        'active', 'pending', 'pending_activation'
      )
  ) then
    raise exception 'OWNER_EMAIL_ALREADY_REGISTERED';
  end if;

  update public.clinic_memberships
  set
    status = 'inactive',
    updated_at = changed_at
  where id = current_membership.id;

  insert into public.clinic_memberships (
    clinic_id,
    invited_at,
    role,
    status,
    user_id
  )
  values (
    target_clinic_id,
    changed_at,
    'clinic_owner',
    'pending_activation',
    replacement_owner_user_id
  )
  returning id into replacement_membership_id;

  update public.profiles
  set
    activated_at = null,
    clinic_id = target_clinic_id,
    invited_at = changed_at,
    is_active = true,
    role = 'clinic_admin',
    updated_at = changed_at
  where id = replacement_owner_user_id;

  if not found then
    raise exception 'REPLACEMENT_PROFILE_NOT_FOUND';
  end if;

  update public.profiles
  set
    clinic_id = null,
    updated_at = changed_at
  where id = expected_owner_user_id
    and clinic_id = target_clinic_id;

  insert into public.platform_clinic_owner_corrections (
    clinic_id,
    performed_by,
    previous_owner_user_id,
    replacement_owner_user_id
  )
  values (
    target_clinic_id,
    target_performed_by,
    expected_owner_user_id,
    replacement_owner_user_id
  );

  return jsonb_build_object(
    'clinicId', target_clinic_id,
    'membershipId', replacement_membership_id,
    'previousOwnerUserId', expected_owner_user_id,
    'replacementOwnerUserId', replacement_owner_user_id,
    'updatedAt', changed_at
  );
end;
$$;

revoke all on function public.replace_pending_platform_clinic_owner(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.replace_pending_platform_clinic_owner(
  uuid, uuid, uuid, uuid
) to service_role;

comment on table public.platform_clinic_owner_corrections is
  'Immutable audit trail for owner identity replacements made before clinic activation.';

comment on function public.replace_pending_platform_clinic_owner(
  uuid, uuid, uuid, uuid
) is
  'Atomically replaces the owner membership of a pending clinic after a corrected email has been invited.';
