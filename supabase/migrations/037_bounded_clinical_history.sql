-- PERF-005D: bounded patient and global clinical-history reads.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_clinical_record_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select public.normalize_patient_search(value);
$$;

create index if not exists clinical_records_clinic_record_cursor_idx
  on public.clinical_records (clinic_id, record_date desc, id desc);

create index if not exists clinical_records_clinic_patient_record_cursor_idx
  on public.clinical_records (
    clinic_id,
    patient_id,
    record_date desc,
    id desc
  );

create index if not exists clinical_records_search_trgm_idx
  on public.clinical_records
  using gin (
    public.normalize_clinical_record_search(
      reason || ' ' || diagnosis || ' ' || treatment || ' ' ||
      coalesce(observations, '')
    ) extensions.gin_trgm_ops
  );

create or replace function public.get_patient_clinical_records_page(
  target_clinic_id uuid,
  target_patient_id uuid,
  target_after_record_date timestamptz default null,
  target_after_id uuid default null,
  target_page_size integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result_payload jsonb;
begin
  if target_clinic_id is null
    or target_patient_id is null
    or target_page_size < 1
    or target_page_size > 30
    or (target_after_record_date is null) <> (target_after_id is null) then
    raise exception 'INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS'
      using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_access_clinical_records(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.patients patients
    where patients.id = target_patient_id
      and patients.clinic_id = target_clinic_id
  ) then
    raise exception 'PATIENT_NOT_FOUND' using errcode = '22023';
  end if;

  with candidates as materialized (
    select records.*
    from public.clinical_records records
    where records.clinic_id = target_clinic_id
      and records.patient_id = target_patient_id
      and (
        target_after_record_date is null
        or (records.record_date, records.id)
          < (target_after_record_date, target_after_id)
      )
    order by records.record_date desc, records.id desc
    limit target_page_size + 1
  ),
  visible as materialized (
    select candidates.*
    from candidates
    order by candidates.record_date desc, candidates.id desc
    limit target_page_size
  )
  select jsonb_build_object(
    'records', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', visible.id,
            'patientId', visible.patient_id,
            'date', visible.record_date,
            'reason', visible.reason,
            'diagnosis', visible.diagnosis,
            'treatment', visible.treatment,
            'notes', coalesce(visible.observations, '')
          )
          order by visible.record_date desc, visible.id desc
        )
        from visible
      ),
      '[]'::jsonb
    ),
    'summary', jsonb_build_object(
      'totalRecords', (
        select count(*)
        from public.clinical_records records
        where records.clinic_id = target_clinic_id
          and records.patient_id = target_patient_id
      ),
      'firstRecordDate', (
        select min(records.record_date)
        from public.clinical_records records
        where records.clinic_id = target_clinic_id
          and records.patient_id = target_patient_id
      ),
      'lastRecordDate', (
        select max(records.record_date)
        from public.clinical_records records
        where records.clinic_id = target_clinic_id
          and records.patient_id = target_patient_id
      )
    ),
    'pageInfo', jsonb_build_object(
      'hasMore', (select count(*) > target_page_size from candidates),
      'nextCursor', case
        when not exists (select 1 from visible) then null
        else (
          select jsonb_build_object(
            'recordDate', visible.record_date,
            'id', visible.id
          )
          from visible
          order by visible.record_date asc, visible.id asc
          limit 1
        )
      end
    )
  )
  into result_payload;

  return result_payload;
end;
$$;

create or replace function public.get_clinic_clinical_history_page(
  target_clinic_id uuid,
  target_search text default '',
  target_period text default 'all',
  target_reference_date date default current_date,
  target_after_latest_record_date timestamptz default null,
  target_after_patient_id uuid default null,
  target_page_size integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_search text;
  period_start date;
  period_end date;
  result_payload jsonb;
begin
  if target_clinic_id is null
    or target_reference_date is null
    or target_period not in ('all', 'this-month', 'last-30-days')
    or target_page_size < 1
    or target_page_size > 20
    or (target_after_latest_record_date is null)
      <> (target_after_patient_id is null) then
    raise exception 'INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS'
      using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_access_clinical_records(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  normalized_search := public.normalize_clinical_record_search(target_search);
  period_start := case target_period
    when 'this-month' then date_trunc('month', target_reference_date)::date
    when 'last-30-days' then target_reference_date - 29
    else null
  end;
  period_end := target_reference_date + 1;

  with matching_records as materialized (
    select
      records.*,
      patients.first_name,
      patients.last_name,
      patients.phone
    from public.clinical_records records
    join public.patients patients
      on patients.id = records.patient_id
      and patients.clinic_id = records.clinic_id
    where records.clinic_id = target_clinic_id
      and (
        period_start is null
        or (
          records.record_date >= period_start::timestamptz
          and records.record_date < period_end::timestamptz
        )
      )
      and (
        normalized_search = ''
        or public.normalize_patient_search(
          patients.first_name || ' ' || patients.last_name || ' ' ||
          patients.phone || ' ' || coalesce(patients.email, '')
        ) like '%' || normalized_search || '%'
        or public.normalize_clinical_record_search(
          records.reason || ' ' || records.diagnosis || ' ' ||
          records.treatment || ' ' || coalesce(records.observations, '')
        ) like '%' || normalized_search || '%'
      )
  ),
  grouped as materialized (
    select
      matching_records.patient_id,
      max(matching_records.record_date) as latest_record_date,
      count(*) as total_records
    from matching_records
    group by matching_records.patient_id
  ),
  candidate_groups as materialized (
    select grouped.*
    from grouped
    where target_after_latest_record_date is null
      or (grouped.latest_record_date, grouped.patient_id)
        < (target_after_latest_record_date, target_after_patient_id)
    order by grouped.latest_record_date desc, grouped.patient_id desc
    limit target_page_size + 1
  ),
  visible_groups as materialized (
    select candidate_groups.*
    from candidate_groups
    order by
      candidate_groups.latest_record_date desc,
      candidate_groups.patient_id desc
    limit target_page_size
  )
  select jsonb_build_object(
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'patientId', visible_groups.patient_id,
            'patientName', btrim(patients.first_name || ' ' || patients.last_name),
            'patientPhone', patients.phone,
            'totalRecords', visible_groups.total_records,
            'records', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', previews.id,
                    'patientId', previews.patient_id,
                    'date', previews.record_date,
                    'reason', previews.reason,
                    'diagnosis', previews.diagnosis,
                    'treatment', previews.treatment,
                    'notes', coalesce(previews.observations, '')
                  )
                  order by previews.record_date desc, previews.id desc
                )
                from (
                  select matching_records.*
                  from matching_records
                  where matching_records.patient_id = visible_groups.patient_id
                  order by
                    matching_records.record_date desc,
                    matching_records.id desc
                  limit 3
                ) previews
              ),
              '[]'::jsonb
            )
          )
          order by
            visible_groups.latest_record_date desc,
            visible_groups.patient_id desc
        )
        from visible_groups
        join public.patients patients
          on patients.id = visible_groups.patient_id
          and patients.clinic_id = target_clinic_id
      ),
      '[]'::jsonb
    ),
    'summary', jsonb_build_object(
      'totalRecords', (select count(*) from matching_records),
      'recordsThisMonth', (
        select count(*)
        from matching_records
        where matching_records.record_date >=
          date_trunc('month', target_reference_date)::date::timestamptz
          and matching_records.record_date < period_end::timestamptz
      ),
      'patientsWithHistory', (
        select count(distinct matching_records.patient_id)
        from matching_records
      )
    ),
    'pageInfo', jsonb_build_object(
      'hasMore', (select count(*) > target_page_size from candidate_groups),
      'nextCursor', case
        when not exists (select 1 from visible_groups) then null
        else (
          select jsonb_build_object(
            'latestRecordDate', visible_groups.latest_record_date,
            'patientId', visible_groups.patient_id
          )
          from visible_groups
          order by
            visible_groups.latest_record_date asc,
            visible_groups.patient_id asc
          limit 1
        )
      end
    )
  )
  into result_payload;

  return result_payload;
end;
$$;

revoke all on function public.get_patient_clinical_records_page(
  uuid, uuid, timestamptz, uuid, integer
) from public, anon;

grant execute on function public.get_patient_clinical_records_page(
  uuid, uuid, timestamptz, uuid, integer
) to authenticated, service_role;

revoke all on function public.get_clinic_clinical_history_page(
  uuid, text, text, date, timestamptz, uuid, integer
) from public, anon;

grant execute on function public.get_clinic_clinical_history_page(
  uuid, text, text, date, timestamptz, uuid, integer
) to authenticated, service_role;

comment on function public.get_patient_clinical_records_page(
  uuid, uuid, timestamptz, uuid, integer
) is
  'Returns one authorized, cursor-based clinical-record page for one patient.';

comment on function public.get_clinic_clinical_history_page(
  uuid, text, text, date, timestamptz, uuid, integer
) is
  'Returns authorized patient groups, summaries and previews for global clinical history.';
