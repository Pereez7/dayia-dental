-- PERF-005A: bounded clinic dashboard.
--
-- The dashboard must not download the complete appointment and change-log
-- history. This migration exposes one authorized snapshot with fixed limits
-- and adds the indexes used by its ordered lookups.

create index if not exists appointments_clinic_active_schedule_idx
  on public.appointments (clinic_id, appointment_date, start_time, id)
  where status in ('pending', 'confirmed', 'rescheduled');

create index if not exists appointment_change_logs_clinic_created_idx
  on public.appointment_change_logs (clinic_id, created_at desc, id desc);

create index if not exists appointment_change_logs_clinic_type_created_idx
  on public.appointment_change_logs (
    clinic_id,
    type,
    created_at desc,
    appointment_id
  );

create index if not exists patients_clinic_created_idx
  on public.patients (clinic_id, created_at desc, id desc);

create or replace function public.get_clinic_dashboard_snapshot(
  target_clinic_id uuid,
  target_reference_date date,
  target_reference_time time without time zone
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
  attention_payload jsonb;
  month_end date;
  month_start date;
  month_start_at timestamptz;
  month_end_at timestamptz;
  monthly_cancelled integer;
  monthly_rescheduled integer;
  recent_activity_payload jsonb;
  recent_patients_payload jsonb;
  recent_threshold timestamptz;
  registered_patients integer;
  summary_payload jsonb;
  today_confirmed integer;
  today_pending integer;
  today_total integer;
  upcoming_payload jsonb;
begin
  if target_clinic_id is null
    or target_reference_date is null
    or target_reference_time is null then
    raise exception 'INVALID_DASHBOARD_ARGUMENTS' using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_access_clinic_data(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  month_start := date_trunc('month', target_reference_date)::date;
  month_end := (month_start + interval '1 month')::date;
  month_start_at := month_start::timestamp at time zone 'America/La_Paz';
  month_end_at := month_end::timestamp at time zone 'America/La_Paz';
  recent_threshold := (
    target_reference_date::timestamp + target_reference_time - interval '14 days'
  ) at time zone 'America/La_Paz';

  select
    count(*) filter (
      where appointments.status = any(active_statuses)
    )::integer,
    count(*) filter (where appointments.status = 'pending')::integer,
    count(*) filter (where appointments.status = 'confirmed')::integer
  into today_total, today_pending, today_confirmed
  from public.appointments appointments
  where appointments.clinic_id = target_clinic_id
    and appointments.appointment_date = target_reference_date;

  select count(*)::integer
  into registered_patients
  from public.patients patients
  where patients.clinic_id = target_clinic_id;

  select
    (
      select count(*)::integer
      from public.appointment_change_logs logs
      where logs.clinic_id = target_clinic_id
        and logs.type = 'cancelled'
        and logs.created_at >= month_start_at
        and logs.created_at < month_end_at
    ) + (
      select count(*)::integer
      from public.appointments appointments
      where appointments.clinic_id = target_clinic_id
        and appointments.status = 'cancelled'
        and appointments.appointment_date >= month_start
        and appointments.appointment_date < month_end
        and not exists (
          select 1
          from public.appointment_change_logs logs
          where logs.clinic_id = target_clinic_id
            and logs.appointment_id = appointments.id
        )
    )
  into monthly_cancelled;

  select
    (
      select count(*)::integer
      from public.appointment_change_logs logs
      where logs.clinic_id = target_clinic_id
        and logs.type = 'rescheduled'
        and logs.created_at >= month_start_at
        and logs.created_at < month_end_at
    ) + (
      select count(*)::integer
      from public.appointments appointments
      where appointments.clinic_id = target_clinic_id
        and appointments.status = 'rescheduled'
        and appointments.appointment_date >= month_start
        and appointments.appointment_date < month_end
        and not exists (
          select 1
          from public.appointment_change_logs logs
          where logs.clinic_id = target_clinic_id
            and logs.appointment_id = appointments.id
        )
    )
  into monthly_rescheduled;

  summary_payload := jsonb_build_object(
    'monthlyCancelledAppointments', monthly_cancelled,
    'monthlyRescheduledAppointments', monthly_rescheduled,
    'registeredPatients', registered_patients,
    'todayAppointments', today_total,
    'todayConfirmedAppointments', today_confirmed,
    'todayPendingAppointments', today_pending
  );

  select coalesce(
    jsonb_agg(
      upcoming_rows.payload
      order by
        upcoming_rows.appointment_date,
        upcoming_rows.start_time,
        upcoming_rows.id
    ),
    '[]'::jsonb
  )
  into upcoming_payload
  from (
    select
      appointments.appointment_date,
      appointments.id,
      appointments.start_time,
      jsonb_build_object(
        'date', appointments.appointment_date::text,
        'durationMinutes', appointments.duration_minutes,
        'id', appointments.id::text,
        'patient', btrim(concat_ws(' ', patients.first_name, patients.last_name)),
        'patientId', appointments.patient_id::text,
        'status', appointments.status,
        'time', to_char(appointments.start_time, 'HH24:MI'),
        'treatment', coalesce(appointments.reason, 'Tratamiento no registrado')
      ) as payload
    from public.appointments appointments
    join public.patients patients
      on patients.id = appointments.patient_id
      and patients.clinic_id = appointments.clinic_id
    where appointments.clinic_id = target_clinic_id
      and appointments.status = any(active_statuses)
      and (
        appointments.appointment_date > target_reference_date
        or (
          appointments.appointment_date = target_reference_date
          and appointments.start_time >= target_reference_time
        )
      )
    order by
      appointments.appointment_date,
      appointments.start_time,
      appointments.id
    limit 5
  ) upcoming_rows;

  select coalesce(
    jsonb_agg(
      attention_rows.payload
      order by
        attention_rows.priority,
        attention_rows.appointment_date,
        attention_rows.start_time,
        attention_rows.event_at desc nulls last,
        attention_rows.id
    ),
    '[]'::jsonb
  )
  into attention_payload
  from (
    select attention_candidates.*
    from (
      (
      select
        appointments.appointment_date,
        null::timestamptz as event_at,
        appointments.id,
        1 as priority,
        appointments.start_time,
        jsonb_build_object(
          'changeLog', '[]'::jsonb,
          'date', appointments.appointment_date::text,
          'durationMinutes', appointments.duration_minutes,
          'id', appointments.id::text,
          'patient', btrim(concat_ws(' ', patients.first_name, patients.last_name)),
          'patientId', appointments.patient_id::text,
          'status', appointments.status,
          'time', to_char(appointments.start_time, 'HH24:MI'),
          'treatment', coalesce(appointments.reason, 'Tratamiento no registrado')
        ) as payload
      from public.appointments appointments
      join public.patients patients
        on patients.id = appointments.patient_id
        and patients.clinic_id = appointments.clinic_id
      where appointments.clinic_id = target_clinic_id
        and appointments.status = 'pending'
        and appointments.appointment_date >= target_reference_date
      order by
        appointments.appointment_date,
        appointments.start_time,
        appointments.id
      limit 5
      )
      union all
      (
      select
        appointments.appointment_date,
        latest_log.created_at as event_at,
        appointments.id,
        2 as priority,
        appointments.start_time,
        jsonb_build_object(
          'changeLog', jsonb_build_array(
            jsonb_build_object(
              'createdAt', latest_log.created_at,
              'description', coalesce(latest_log.description, ''),
              'id', latest_log.id::text,
              'metadata', jsonb_strip_nulls(
                jsonb_build_object(
                  'fromDate', latest_log.from_date,
                  'fromTime', to_char(latest_log.from_time, 'HH24:MI'),
                  'toDate', latest_log.to_date,
                  'toTime', to_char(latest_log.to_time, 'HH24:MI')
                )
              ),
              'type', latest_log.type
            )
          ),
          'date', appointments.appointment_date::text,
          'durationMinutes', appointments.duration_minutes,
          'id', appointments.id::text,
          'patient', btrim(concat_ws(' ', patients.first_name, patients.last_name)),
          'patientId', appointments.patient_id::text,
          'status', appointments.status,
          'time', to_char(appointments.start_time, 'HH24:MI'),
          'treatment', coalesce(appointments.reason, 'Tratamiento no registrado')
        ) as payload
      from public.appointments appointments
      join public.patients patients
        on patients.id = appointments.patient_id
        and patients.clinic_id = appointments.clinic_id
      join lateral (
        select logs.*
        from public.appointment_change_logs logs
        where logs.clinic_id = target_clinic_id
          and logs.appointment_id = appointments.id
          and logs.type = 'rescheduled'
          and logs.created_at >= recent_threshold
          and logs.created_at <= (
            target_reference_date::timestamp + target_reference_time
          ) at time zone 'America/La_Paz'
        order by logs.created_at desc, logs.id desc
        limit 1
      ) latest_log on true
      where appointments.clinic_id = target_clinic_id
        and appointments.status = any(active_statuses)
        and appointments.appointment_date >= target_reference_date
      order by latest_log.created_at desc, appointments.id
      limit 5
      )
    ) attention_candidates
    order by
      attention_candidates.priority,
      attention_candidates.appointment_date,
      attention_candidates.start_time,
      attention_candidates.event_at desc nulls last,
      attention_candidates.id
    limit 5
  ) attention_rows;

  select coalesce(
    jsonb_agg(
      activity_rows.payload
      order by activity_rows.created_at desc, activity_rows.log_id desc
    ),
    '[]'::jsonb
  )
  into recent_activity_payload
  from (
    select
      logs.created_at,
      logs.id as log_id,
      jsonb_build_object(
        'changeLog', jsonb_build_array(
          jsonb_build_object(
            'createdAt', logs.created_at,
            'description', coalesce(logs.description, ''),
            'id', logs.id::text,
            'metadata', jsonb_strip_nulls(
              jsonb_build_object(
                'fromDate', logs.from_date,
                'fromTime', to_char(logs.from_time, 'HH24:MI'),
                'toDate', logs.to_date,
                'toTime', to_char(logs.to_time, 'HH24:MI')
              )
            ),
            'type', logs.type
          )
        ),
        'date', appointments.appointment_date::text,
        'durationMinutes', appointments.duration_minutes,
        'id', appointments.id::text,
        'patient', btrim(concat_ws(' ', patients.first_name, patients.last_name)),
        'patientId', appointments.patient_id::text,
        'status', appointments.status,
        'time', to_char(appointments.start_time, 'HH24:MI'),
        'treatment', coalesce(appointments.reason, 'Tratamiento no registrado')
      ) as payload
    from public.appointment_change_logs logs
    join public.appointments appointments
      on appointments.id = logs.appointment_id
      and appointments.clinic_id = logs.clinic_id
    join public.patients patients
      on patients.id = appointments.patient_id
      and patients.clinic_id = appointments.clinic_id
    where logs.clinic_id = target_clinic_id
    order by logs.created_at desc, logs.id desc
    limit 5
  ) activity_rows;

  select coalesce(
    jsonb_agg(
      patient_rows.payload
      order by patient_rows.created_at desc, patient_rows.id desc
    ),
    '[]'::jsonb
  )
  into recent_patients_payload
  from (
    select
      patients.created_at,
      patients.id,
      jsonb_build_object(
        'birthDate', patients.birth_date,
        'countryCode', patients.country_code,
        'email', patients.email,
        'firstName', patients.first_name,
        'fullName', btrim(concat_ws(' ', patients.first_name, patients.last_name)),
        'id', patients.id::text,
        'lastName', patients.last_name,
        'lastVisit', 'Sin registro',
        'nextAppointment', null,
        'phone', patients.phone,
        'status', 'active'
      ) as payload
    from public.patients patients
    where patients.clinic_id = target_clinic_id
    order by patients.created_at desc, patients.id desc
    limit 4
  ) patient_rows;

  return jsonb_build_object(
    'attentionAppointments', attention_payload,
    'recentActivityAppointments', recent_activity_payload,
    'recentPatients', recent_patients_payload,
    'summary', summary_payload,
    'upcomingAppointments', upcoming_payload
  );
end;
$$;

revoke all on function public.get_clinic_dashboard_snapshot(
  uuid,
  date,
  time without time zone
) from public, anon;

grant execute on function public.get_clinic_dashboard_snapshot(
  uuid,
  date,
  time without time zone
) to authenticated;

comment on function public.get_clinic_dashboard_snapshot(
  uuid,
  date,
  time without time zone
) is
  'Returns a fixed-size clinic dashboard snapshot after active clinical access authorization.';
