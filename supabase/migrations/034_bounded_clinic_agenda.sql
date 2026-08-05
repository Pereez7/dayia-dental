-- PERF-005B1: bounded clinic agenda reads.
--
-- The agenda receives one selected day, a cursor-bounded visible page, the
-- complete status totals for that day and only the minimal active schedule
-- required to calculate availability. It never downloads the clinic history.

create index if not exists appointments_clinic_day_schedule_idx
  on public.appointments (clinic_id, appointment_date, start_time, id);

create index if not exists appointment_change_logs_appointment_recent_idx
  on public.appointment_change_logs (
    clinic_id,
    appointment_id,
    created_at desc,
    id desc
  );

create or replace function public.get_clinic_agenda_snapshot(
  target_clinic_id uuid,
  target_selected_date date,
  target_reference_date date,
  target_page_size integer default 20,
  target_after_start_time time without time zone default null,
  target_after_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_statuses constant text[] := array[
    'pending',
    'confirmed',
    'rescheduled'
  ];
  appointments_payload jsonb;
  availability_payload jsonb;
  day_options_payload jsonb;
  has_more boolean;
  last_appointment_id uuid;
  last_start_time time without time zone;
  status_payload jsonb;
begin
  if target_clinic_id is null
    or target_selected_date is null
    or target_reference_date is null
    or target_page_size is null
    or target_page_size < 1
    or target_page_size > 50
    or ((target_after_start_time is null) <> (target_after_id is null)) then
    raise exception 'INVALID_AGENDA_ARGUMENTS' using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_access_clinic_data(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'cancelled', count(*) filter (where status = 'cancelled')::integer,
    'completed', count(*) filter (where status = 'completed')::integer,
    'confirmed', count(*) filter (where status = 'confirmed')::integer,
    'no_show', count(*) filter (where status = 'no_show')::integer,
    'pending', count(*) filter (where status = 'pending')::integer,
    'rescheduled', count(*) filter (where status = 'rescheduled')::integer,
    'total', count(*)::integer
  )
  into status_payload
  from public.appointments
  where clinic_id = target_clinic_id
    and appointment_date = target_selected_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', schedule.appointment_date::text,
        'durationMinutes', schedule.duration_minutes,
        'id', schedule.id::text,
        'patient', '',
        'patientId', schedule.patient_id::text,
        'status', schedule.status,
        'time', to_char(schedule.start_time, 'HH24:MI'),
        'treatment', coalesce(schedule.reason, 'Tratamiento no registrado')
      )
      order by schedule.start_time, schedule.id
    ),
    '[]'::jsonb
  )
  into availability_payload
  from public.appointments schedule
  where schedule.clinic_id = target_clinic_id
    and schedule.appointment_date = target_selected_date
    and schedule.status = any(active_statuses);

  with requested_rows as (
    select
      appointments.*,
      patients.first_name,
      patients.last_name,
      patients.phone as patient_phone,
      latest_log.created_at as log_created_at,
      latest_log.description as log_description,
      latest_log.from_date as log_from_date,
      latest_log.from_time as log_from_time,
      latest_log.id as log_id,
      latest_log.to_date as log_to_date,
      latest_log.to_time as log_to_time,
      latest_log.type as log_type
    from public.appointments appointments
    join public.patients patients
      on patients.id = appointments.patient_id
      and patients.clinic_id = appointments.clinic_id
    left join lateral (
      select logs.*
      from public.appointment_change_logs logs
      where logs.clinic_id = appointments.clinic_id
        and logs.appointment_id = appointments.id
        and logs.type in ('confirmed', 'cancelled', 'rescheduled')
      order by logs.created_at desc, logs.id desc
      limit 1
    ) latest_log on true
    where appointments.clinic_id = target_clinic_id
      and appointments.appointment_date = target_selected_date
      and (
        target_after_start_time is null
        or (appointments.start_time, appointments.id)
          > (target_after_start_time, target_after_id)
      )
    order by appointments.start_time, appointments.id
    limit target_page_size + 1
  ),
  visible_rows as (
    select *
    from requested_rows
    order by start_time, id
    limit target_page_size
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'cancellationReason', visible_rows.cancel_reason,
            'changeLog', case
              when visible_rows.log_id is null then '[]'::jsonb
              else jsonb_build_array(
                jsonb_build_object(
                  'createdAt', visible_rows.log_created_at,
                  'description', coalesce(visible_rows.log_description, ''),
                  'id', visible_rows.log_id::text,
                  'metadata', jsonb_strip_nulls(
                    jsonb_build_object(
                      'fromDate', visible_rows.log_from_date,
                      'fromTime', case
                        when visible_rows.log_from_time is null then null
                        else to_char(visible_rows.log_from_time, 'HH24:MI')
                      end,
                      'toDate', visible_rows.log_to_date,
                      'toTime', case
                        when visible_rows.log_to_time is null then null
                        else to_char(visible_rows.log_to_time, 'HH24:MI')
                      end
                    )
                  ),
                  'type', visible_rows.log_type
                )
              )
            end,
            'date', visible_rows.appointment_date::text,
            'durationMinutes', visible_rows.duration_minutes,
            'id', visible_rows.id::text,
            'patient', btrim(concat_ws(
              ' ',
              visible_rows.first_name,
              visible_rows.last_name
            )),
            'patientId', visible_rows.patient_id::text,
            'patientPhone', visible_rows.patient_phone,
            'rescheduleReason', visible_rows.reschedule_reason,
            'status', visible_rows.status,
            'time', to_char(visible_rows.start_time, 'HH24:MI'),
            'treatment', coalesce(
              visible_rows.reason,
              'Tratamiento no registrado'
            )
          )
        )
        order by visible_rows.start_time, visible_rows.id
      ),
      '[]'::jsonb
    ),
    (select count(*) > target_page_size from requested_rows),
    (
      select id
      from visible_rows
      order by start_time desc, id desc
      limit 1
    ),
    (
      select start_time
      from visible_rows
      order by start_time desc, id desc
      limit 1
    )
  into
    appointments_payload,
    has_more,
    last_appointment_id,
    last_start_time
  from visible_rows;

  with candidate_dates as (
    select target_reference_date as appointment_date
    union
    select target_reference_date + 1
    union
    select target_selected_date
    union
    select future_dates.appointment_date
    from (
      select distinct appointments.appointment_date
      from public.appointments appointments
      where appointments.clinic_id = target_clinic_id
        and appointments.appointment_date >= target_reference_date
      order by appointments.appointment_date
      limit 8
    ) future_dates
  )
  select coalesce(
    jsonb_agg(candidate_dates.appointment_date::text order by appointment_date),
    '[]'::jsonb
  )
  into day_options_payload
  from candidate_dates;

  return jsonb_build_object(
    'appointments', appointments_payload,
    'availabilityAppointments', availability_payload,
    'dayOptions', day_options_payload,
    'pageInfo', jsonb_build_object(
      'hasMore', has_more,
      'nextCursor', case
        when has_more and last_appointment_id is not null then
          jsonb_build_object(
            'id', last_appointment_id::text,
            'startTime', to_char(last_start_time, 'HH24:MI')
          )
        else null
      end
    ),
    'selectedDate', target_selected_date::text,
    'statusSummary', status_payload
  );
end;
$$;

revoke all on function public.get_clinic_agenda_snapshot(
  uuid,
  date,
  date,
  integer,
  time without time zone,
  uuid
) from public, anon;

grant execute on function public.get_clinic_agenda_snapshot(
  uuid,
  date,
  date,
  integer,
  time without time zone,
  uuid
) to authenticated;

comment on function public.get_clinic_agenda_snapshot(
  uuid,
  date,
  date,
  integer,
  time without time zone,
  uuid
) is
  'Returns one authorized, cursor-bounded agenda day plus minimal availability data.';
