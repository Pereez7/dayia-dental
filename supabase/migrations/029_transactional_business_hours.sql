-- Save the complete weekly schedule as one authorized transaction.
--
-- The frontend previously used INSERT ... ON CONFLICT directly. PostgreSQL
-- correctly rejected that request after migration 027 because an upsert also
-- attempts to update the immutable conflict columns (clinic_id, weekday).

create or replace function public.save_clinic_business_hours(
  target_clinic_id uuid,
  target_hours jsonb
)
returns setof public.business_hours
language plpgsql
security definer
set search_path = public
as $$
declare
  hours_count integer;
  distinct_weekdays integer;
  first_weekday integer;
  last_weekday integer;
  minimum_interval integer;
  maximum_interval integer;
  hours_are_valid boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if target_clinic_id is null
    or not public.can_manage_clinic_settings(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if target_hours is null
    or jsonb_typeof(target_hours) <> 'array' then
    raise exception 'INVALID_BUSINESS_HOURS' using errcode = '22023';
  end if;

  with parsed_hours as (
    select
      (entry.value->>'weekday')::integer as weekday,
      (entry.value->>'is_open')::boolean as is_open,
      nullif(entry.value->>'start_time', '')::time as start_time,
      nullif(entry.value->>'end_time', '')::time as end_time,
      (entry.value->>'slot_interval_minutes')::integer
        as slot_interval_minutes
    from jsonb_array_elements(target_hours) as entry(value)
  )
  select
    count(*),
    count(distinct weekday),
    min(weekday),
    max(weekday),
    min(slot_interval_minutes),
    max(slot_interval_minutes),
    bool_and(
      weekday between 0 and 6
      and is_open is not null
      and slot_interval_minutes in (15, 30, 45, 60)
      and (
        is_open = false
        or (
          start_time is not null
          and end_time is not null
          and start_time < end_time
        )
      )
    )
  into
    hours_count,
    distinct_weekdays,
    first_weekday,
    last_weekday,
    minimum_interval,
    maximum_interval,
    hours_are_valid
  from parsed_hours;

  if hours_count <> 7
    or distinct_weekdays <> 7
    or first_weekday <> 0
    or last_weekday <> 6
    or minimum_interval <> maximum_interval
    or hours_are_valid is not true then
    raise exception 'INVALID_BUSINESS_HOURS' using errcode = '22023';
  end if;

  insert into public.business_hours (
    clinic_id,
    weekday,
    is_open,
    start_time,
    end_time,
    slot_interval_minutes
  )
  select
    target_clinic_id,
    parsed.weekday,
    parsed.is_open,
    case when parsed.is_open then parsed.start_time else null end,
    case when parsed.is_open then parsed.end_time else null end,
    parsed.slot_interval_minutes
  from (
    select
      (entry.value->>'weekday')::integer as weekday,
      (entry.value->>'is_open')::boolean as is_open,
      nullif(entry.value->>'start_time', '')::time as start_time,
      nullif(entry.value->>'end_time', '')::time as end_time,
      (entry.value->>'slot_interval_minutes')::integer
        as slot_interval_minutes
    from jsonb_array_elements(target_hours) as entry(value)
  ) as parsed
  on conflict (clinic_id, weekday)
  do update set
    is_open = excluded.is_open,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    slot_interval_minutes = excluded.slot_interval_minutes;

  return query
  select hours.*
  from public.business_hours as hours
  where hours.clinic_id = target_clinic_id
  order by hours.weekday;
end;
$$;

revoke all on function public.save_clinic_business_hours(uuid, jsonb)
  from public, anon;
grant execute on function public.save_clinic_business_hours(uuid, jsonb)
  to authenticated, service_role;

comment on function public.save_clinic_business_hours(uuid, jsonb) is
  'Validates and saves the seven clinic business-hour rows atomically.';
