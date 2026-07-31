-- PERF-004: idempotent platform clinic creation with one PostgreSQL commit.
-- Auth invitation remains external, but every public record is written
-- atomically and can be recovered safely after an ambiguous response.

do $profile_email_uniqueness$
begin
  if exists (
    select 1
    from public.profiles
    where nullif(btrim(email), '') is not null
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_PROFILE_EMAILS_REQUIRE_REVIEW';
  end if;
end;
$profile_email_uniqueness$;

create unique index if not exists profiles_normalized_email_unique_idx
  on public.profiles (lower(btrim(email)))
  where nullif(btrim(email), '') is not null;

comment on index public.profiles_normalized_email_unique_idx is
  'Globally prevents two DayIA profiles from representing the same normalized Auth email.';

create table if not exists public.platform_clinic_creation_requests (
  id uuid primary key,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  payload_fingerprint text not null,
  clinic_name text not null,
  normalized_clinic_name text not null,
  owner_name text not null,
  owner_email text not null,
  normalized_owner_email text not null,
  plan_id text not null references public.plans(id),
  price_tier text not null,
  status text not null default 'reserved',
  clinic_id uuid references public.clinics(id) on delete set null,
  owner_user_id uuid,
  activation_status text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint platform_clinic_creation_fingerprint_format check (
    payload_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint platform_clinic_creation_price_tier_allowed check (
    price_tier in ('standard', 'founder')
  ),
  constraint platform_clinic_creation_status_allowed check (
    status in ('reserved', 'completed', 'failed')
  ),
  constraint platform_clinic_creation_activation_status_allowed check (
    activation_status is null
    or activation_status in ('pending', 'already_active')
  ),
  constraint platform_clinic_creation_completed_state check (
    (
      status = 'completed'
      and clinic_id is not null
      and owner_user_id is not null
      and activation_status is not null
      and completed_at is not null
      and last_error_code is null
    )
    or (
      status = 'reserved'
      and clinic_id is null
      and completed_at is null
      and last_error_code is null
    )
    or (
      status = 'failed'
      and clinic_id is null
      and completed_at is null
      and last_error_code is not null
    )
  )
);

create unique index if not exists platform_clinic_creation_requester_payload_idx
  on public.platform_clinic_creation_requests (
    requested_by,
    payload_fingerprint
  );

create unique index if not exists platform_clinic_creation_reserved_name_idx
  on public.platform_clinic_creation_requests (normalized_clinic_name)
  where status in ('reserved', 'completed');

create unique index if not exists platform_clinic_creation_reserved_email_idx
  on public.platform_clinic_creation_requests (normalized_owner_email)
  where status in ('reserved', 'completed');

create index if not exists platform_clinic_creation_status_updated_idx
  on public.platform_clinic_creation_requests (status, updated_at);

alter table public.platform_clinic_creation_requests enable row level security;

revoke all on public.platform_clinic_creation_requests
  from public, anon, authenticated;
grant select, insert, update on public.platform_clinic_creation_requests
  to service_role;

create or replace function public.get_platform_clinic_creation_request(
  target_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_request public.platform_clinic_creation_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select requests.*
  into target_request
  from public.platform_clinic_creation_requests requests
  where requests.id = target_request_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'requestId', target_request.id,
    'status', target_request.status,
    'clinicId', target_request.clinic_id,
    'clinicName', target_request.clinic_name,
    'ownerUserId', target_request.owner_user_id,
    'ownerEmail', target_request.owner_email,
    'ownerName', target_request.owner_name,
    'planId', target_request.plan_id,
    'priceTier', target_request.price_tier,
    'activationStatus', target_request.activation_status
  );
end;
$$;

create or replace function public.lookup_auth_user_by_email(
  target_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(nullif(btrim(target_email), ''));
  target_user auth.users%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if normalized_email is null then
    raise exception 'INVALID_EMAIL';
  end if;

  select users.*
  into target_user
  from auth.users users
  where users.email = normalized_email
    and users.is_sso_user = false
  order by users.created_at, users.id
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', target_user.id,
    'email', lower(btrim(target_user.email)),
    'isConfirmed', (
      target_user.email_confirmed_at is not null
      or target_user.confirmed_at is not null
    ),
    'creationRequestId',
      target_user.raw_user_meta_data ->> 'dayia_creation_request_id'
  );
end;
$$;

create or replace function public.begin_platform_clinic_creation(
  target_request_id uuid,
  target_requested_by uuid,
  target_payload_fingerprint text,
  target_clinic_name text,
  target_owner_name text,
  target_owner_email text,
  target_plan_id text,
  target_price_tier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_clinic_name text :=
    lower(regexp_replace(btrim(target_clinic_name), '\s+', ' ', 'g'));
  canonical_owner_email text := lower(nullif(btrim(target_owner_email), ''));
  canonical_owner_name text :=
    regexp_replace(btrim(target_owner_name), '\s+', ' ', 'g');
  selected_plan public.plans%rowtype;
  target_request public.platform_clinic_creation_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if target_request_id is null
    or target_requested_by is null
    or target_payload_fingerprint is null
    or target_payload_fingerprint !~ '^[0-9a-f]{64}$'
    or canonical_clinic_name = ''
    or canonical_owner_name = ''
    or canonical_owner_email is null
    or position('@' in canonical_owner_email) <= 1
    or target_plan_id not in ('basic', 'medium', 'pro')
    or target_price_tier not in ('standard', 'founder') then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if not exists (
    select 1
    from public.profiles profiles
    where profiles.id = target_requested_by
      and profiles.is_platform_admin = true
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select requests.*
  into target_request
  from public.platform_clinic_creation_requests requests
  where requests.requested_by = target_requested_by
    and requests.payload_fingerprint = target_payload_fingerprint
  for update;

  if found then
    if target_request.normalized_clinic_name <> canonical_clinic_name
      or target_request.normalized_owner_email <> canonical_owner_email
      or target_request.owner_name <> canonical_owner_name
      or target_request.plan_id <> target_plan_id
      or target_request.price_tier <> target_price_tier then
      raise exception 'REQUEST_PAYLOAD_MISMATCH';
    end if;

    if target_request.status in ('reserved', 'completed') then
      return public.get_platform_clinic_creation_request(target_request.id);
    end if;
  end if;

  select plans.*
  into selected_plan
  from public.plans plans
  where plans.id = target_plan_id
    and plans.is_active = true;

  if not found then
    raise exception 'INVALID_PLAN';
  end if;

  if target_price_tier = 'founder'
    and (
      selected_plan.founder_monthly_price is null
      or selected_plan.founder_monthly_price <= 0
    ) then
    raise exception 'FOUNDER_PRICE_NOT_CONFIGURED';
  end if;

  if exists (
    select 1
    from public.clinics clinics
    where lower(regexp_replace(btrim(clinics.name), '\s+', ' ', 'g'))
      = canonical_clinic_name
  ) then
    raise exception 'CLINIC_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.profiles profiles
    where lower(btrim(profiles.email)) = canonical_owner_email
  ) or exists (
    select 1
    from auth.users users
    where users.email = canonical_owner_email
      and users.is_sso_user = false
  ) then
    raise exception 'OWNER_EMAIL_ALREADY_REGISTERED';
  end if;

  if target_request.id is null then
    begin
      insert into public.platform_clinic_creation_requests (
        id,
        requested_by,
        payload_fingerprint,
        clinic_name,
        normalized_clinic_name,
        owner_name,
        owner_email,
        normalized_owner_email,
        plan_id,
        price_tier
      )
      values (
        target_request_id,
        target_requested_by,
        target_payload_fingerprint,
        regexp_replace(btrim(target_clinic_name), '\s+', ' ', 'g'),
        canonical_clinic_name,
        canonical_owner_name,
        canonical_owner_email,
        canonical_owner_email,
        target_plan_id,
        target_price_tier
      )
      returning * into target_request;
    exception
      when unique_violation then
        if exists (
          select 1
          from public.platform_clinic_creation_requests requests
          where requests.requested_by = target_requested_by
            and requests.payload_fingerprint = target_payload_fingerprint
        ) then
          select requests.*
          into target_request
          from public.platform_clinic_creation_requests requests
          where requests.requested_by = target_requested_by
            and requests.payload_fingerprint = target_payload_fingerprint;

          if target_request.normalized_clinic_name <> canonical_clinic_name
            or target_request.normalized_owner_email <> canonical_owner_email
            or target_request.owner_name <> canonical_owner_name
            or target_request.plan_id <> target_plan_id
            or target_request.price_tier <> target_price_tier then
            raise exception 'REQUEST_PAYLOAD_MISMATCH';
          end if;
        elsif exists (
          select 1
          from public.platform_clinic_creation_requests requests
          where requests.normalized_clinic_name = canonical_clinic_name
            and requests.status in ('reserved', 'completed')
        ) then
          raise exception 'CLINIC_CREATION_IN_PROGRESS';
        else
          raise exception 'OWNER_EMAIL_CREATION_IN_PROGRESS';
        end if;
    end;
  else
    update public.platform_clinic_creation_requests requests
    set
      status = 'reserved',
      owner_user_id = null,
      activation_status = null,
      last_error_code = null,
      updated_at = now()
    where requests.id = target_request.id
    returning * into target_request;
  end if;

  return public.get_platform_clinic_creation_request(target_request.id);
end;
$$;

create or replace function public.complete_platform_clinic_creation(
  target_request_id uuid,
  target_owner_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.platform_clinic_creation_requests%rowtype;
  target_auth_user auth.users%rowtype;
  created_clinic_id uuid;
  changed_at timestamptz := now();
  trial_ends_at timestamptz := changed_at + interval '15 days';
  grace_ends_at timestamptz := changed_at + interval '20 days';
  owner_is_confirmed boolean;
  membership_status text;
  clinic_status text;
  resolved_activation_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select requests.*
  into target_request
  from public.platform_clinic_creation_requests requests
  where requests.id = target_request_id
  for update;

  if not found then
    raise exception 'CREATION_REQUEST_NOT_FOUND';
  end if;

  if target_request.status = 'completed' then
    return public.get_platform_clinic_creation_request(target_request.id);
  end if;

  if target_request.status <> 'reserved' then
    raise exception 'CREATION_REQUEST_NOT_RESERVED';
  end if;

  select users.*
  into target_auth_user
  from auth.users users
  where users.id = target_owner_user_id
    and lower(btrim(users.email)) = target_request.normalized_owner_email
  for update;

  if not found then
    raise exception 'OWNER_AUTH_USER_NOT_FOUND';
  end if;

  if target_auth_user.raw_user_meta_data
      ->> 'dayia_creation_request_id' is distinct from target_request.id::text then
    raise exception 'OWNER_REQUEST_MISMATCH';
  end if;

  owner_is_confirmed :=
    target_auth_user.email_confirmed_at is not null
    or target_auth_user.confirmed_at is not null;
  membership_status := case
    when owner_is_confirmed then 'active'
    else 'pending_activation'
  end;
  clinic_status := case
    when owner_is_confirmed then 'active'
    else 'pending_activation'
  end;
  resolved_activation_status := case
    when owner_is_confirmed then 'already_active'
    else 'pending'
  end;

  insert into public.clinics (name, status, created_at, updated_at)
  values (
    target_request.clinic_name,
    clinic_status,
    changed_at,
    changed_at
  )
  returning id into created_clinic_id;

  insert into public.profiles (
    id,
    clinic_id,
    full_name,
    email,
    invited_at,
    activated_at,
    is_active,
    is_platform_admin,
    role,
    created_at,
    updated_at
  )
  values (
    target_owner_user_id,
    created_clinic_id,
    target_request.owner_name,
    target_request.normalized_owner_email,
    changed_at,
    case when owner_is_confirmed then changed_at else null end,
    true,
    false,
    'clinic_admin',
    changed_at,
    changed_at
  );

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
  values (
    created_clinic_id,
    target_owner_user_id,
    'clinic_owner',
    membership_status,
    changed_at,
    case when owner_is_confirmed then changed_at else null end,
    changed_at,
    changed_at
  );

  insert into public.clinic_subscriptions (
    clinic_id,
    plan_id,
    status,
    starts_at,
    ends_at,
    trial_starts_at,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    grace_ends_at,
    payment_status,
    billing_cycle,
    is_lifetime,
    price_tier,
    founder_price_locked,
    created_at,
    updated_at
  )
  values (
    created_clinic_id,
    target_request.plan_id,
    'trialing',
    changed_at,
    trial_ends_at,
    changed_at,
    trial_ends_at,
    changed_at,
    trial_ends_at,
    grace_ends_at,
    'trial',
    'trial',
    false,
    target_request.price_tier,
    target_request.price_tier = 'founder',
    changed_at,
    changed_at
  );

  update public.platform_clinic_creation_requests requests
  set
    status = 'completed',
    clinic_id = created_clinic_id,
    owner_user_id = target_owner_user_id,
    activation_status = resolved_activation_status,
    completed_at = changed_at,
    updated_at = changed_at
  where requests.id = target_request.id;

  return public.get_platform_clinic_creation_request(target_request.id);
exception
  when unique_violation then
    if sqlerrm like '%clinics_normalized_name_unique_idx%' then
      raise exception 'CLINIC_ALREADY_EXISTS';
    end if;

    if sqlerrm like '%profiles_normalized_email_unique_idx%'
      or sqlerrm like '%profiles_pkey%' then
      raise exception 'OWNER_EMAIL_ALREADY_REGISTERED';
    end if;

    raise;
end;
$$;

create or replace function public.fail_platform_clinic_creation(
  target_request_id uuid,
  target_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if nullif(btrim(target_error_code), '') is null then
    raise exception 'INVALID_ERROR_CODE';
  end if;

  update public.platform_clinic_creation_requests requests
  set
    status = 'failed',
    owner_user_id = null,
    activation_status = null,
    last_error_code = left(btrim(target_error_code), 80),
    updated_at = now()
  where requests.id = target_request_id
    and requests.status = 'reserved';

  return found;
end;
$$;

revoke all on function public.get_platform_clinic_creation_request(uuid)
  from public, anon, authenticated;
revoke all on function public.lookup_auth_user_by_email(text)
  from public, anon, authenticated;
revoke all on function public.begin_platform_clinic_creation(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.complete_platform_clinic_creation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_platform_clinic_creation(uuid, text)
  from public, anon, authenticated;

grant execute on function public.get_platform_clinic_creation_request(uuid)
  to service_role;
grant execute on function public.lookup_auth_user_by_email(text)
  to service_role;
grant execute on function public.begin_platform_clinic_creation(
  uuid, uuid, text, text, text, text, text, text
) to service_role;
grant execute on function public.complete_platform_clinic_creation(uuid, uuid)
  to service_role;
grant execute on function public.fail_platform_clinic_creation(uuid, text)
  to service_role;

comment on table public.platform_clinic_creation_requests is
  'Restricted idempotency and recovery ledger for platform clinic creation.';

comment on function public.lookup_auth_user_by_email(text) is
  'Performs one exact service-role-only lookup for DayIA non-SSO Auth users through the native email index.';

comment on function public.complete_platform_clinic_creation(uuid, uuid) is
  'Atomically creates clinic, profile, owner membership and trial subscription.';
