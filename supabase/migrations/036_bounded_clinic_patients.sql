-- PERF-005C: bounded, searchable patient listing with authoritative duplicates.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_patient_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áéíóúüñàèìòùäëïöüç',
        'aeiouunaeiouaeiouc'
      ),
      '[^a-z0-9@+]+' ,
      ' ',
      'g'
    )
  );
$$;

do $$
begin
  if exists (
    select 1
    from public.patients patients
    group by
      patients.clinic_id,
      regexp_replace(patients.phone, '\D', '', 'g')
    having count(*) > 1
  ) then
    raise exception
      'PATIENT_DUPLICATE_PHONE_PREFLIGHT: resolve repeated clinic phones before applying migration 036';
  end if;

  if exists (
    select 1
    from public.patients patients
    where patients.email is not null
      and btrim(patients.email) <> ''
    group by patients.clinic_id, lower(btrim(patients.email))
    having count(*) > 1
  ) then
    raise exception
      'PATIENT_DUPLICATE_EMAIL_PREFLIGHT: resolve repeated clinic emails before applying migration 036';
  end if;
end;
$$;

create unique index if not exists patients_clinic_phone_normalized_uidx
  on public.patients (
    clinic_id,
    regexp_replace(phone, '\D', '', 'g')
  );

create unique index if not exists patients_clinic_email_normalized_uidx
  on public.patients (clinic_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create index if not exists patients_search_trgm_idx
  on public.patients
  using gin (
    public.normalize_patient_search(
      first_name || ' ' || last_name || ' ' || phone || ' ' || coalesce(email, '')
    ) extensions.gin_trgm_ops
  );

create or replace function public.get_clinic_patients_page(
  target_clinic_id uuid,
  target_search text default '',
  target_reference_date date default current_date,
  target_after_created_at timestamptz default null,
  target_after_id uuid default null,
  target_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_search text;
  result_payload jsonb;
begin
  if target_clinic_id is null
    or target_reference_date is null
    or target_page_size < 1
    or target_page_size > 30
    or (target_after_created_at is null) <> (target_after_id is null) then
    raise exception 'INVALID_PATIENT_PAGE_ARGUMENTS' using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_access_clinic_data(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  normalized_search := public.normalize_patient_search(target_search);

  with candidates as materialized (
    select patients.*
    from public.patients patients
    where patients.clinic_id = target_clinic_id
      and (
        normalized_search = ''
        or public.normalize_patient_search(
          patients.first_name || ' ' ||
          patients.last_name || ' ' ||
          patients.phone || ' ' ||
          coalesce(patients.email, '')
        ) like '%' || normalized_search || '%'
      )
      and (
        target_after_created_at is null
        or (patients.created_at, patients.id)
          < (target_after_created_at, target_after_id)
      )
    order by patients.created_at desc, patients.id desc
    limit target_page_size + 1
  ),
  visible as materialized (
    select candidates.*
    from candidates
    order by candidates.created_at desc, candidates.id desc
    limit target_page_size
  ),
  enriched as (
    select
      visible.*,
      (
        select max(appointments.appointment_date)
        from public.appointments appointments
        where appointments.clinic_id = visible.clinic_id
          and appointments.patient_id = visible.id
          and appointments.status = 'completed'
          and appointments.appointment_date <= target_reference_date
      ) as last_visit,
      (
        select min(appointments.appointment_date)
        from public.appointments appointments
        where appointments.clinic_id = visible.clinic_id
          and appointments.patient_id = visible.id
          and appointments.status in ('pending', 'confirmed', 'rescheduled')
          and appointments.appointment_date >= target_reference_date
      ) as next_appointment
    from visible
  )
  select jsonb_build_object(
    'patients', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', enriched.id,
            'firstName', enriched.first_name,
            'lastName', enriched.last_name,
            'fullName', btrim(enriched.first_name || ' ' || enriched.last_name),
            'countryCode', enriched.country_code,
            'phone', enriched.phone,
            'email', enriched.email,
            'birthDate', enriched.birth_date,
            'lastVisit', enriched.last_visit,
            'nextAppointment', enriched.next_appointment,
            'status', 'active'
          )
          order by enriched.created_at desc, enriched.id desc
        )
        from enriched
      ),
      '[]'::jsonb
    ),
    'pageInfo', jsonb_build_object(
      'hasMore', (select count(*) > target_page_size from candidates),
      'nextCursor', case
        when not exists (select 1 from visible) then null
        else (
          select jsonb_build_object(
            'createdAt', visible.created_at,
            'id', visible.id
          )
          from visible
          order by visible.created_at asc, visible.id asc
          limit 1
        )
      end
    )
  )
  into result_payload;

  return result_payload;
end;
$$;

revoke all on function public.get_clinic_patients_page(
  uuid, text, date, timestamptz, uuid, integer
) from public, anon;

grant execute on function public.get_clinic_patients_page(
  uuid, text, date, timestamptz, uuid, integer
) to authenticated, service_role;

comment on function public.get_clinic_patients_page(
  uuid, text, date, timestamptz, uuid, integer
) is
  'Returns one authorized clinic patient page with normalized server search and a stable creation cursor.';

comment on index public.patients_clinic_phone_normalized_uidx is
  'Prevents concurrent duplicate patient phones within the same clinic.';

comment on index public.patients_clinic_email_normalized_uidx is
  'Prevents concurrent duplicate non-empty patient emails within the same clinic.';
