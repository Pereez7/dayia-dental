-- PERF-005E: bounded reminder queue and atomic reconciliation.

create index if not exists reminders_clinic_appointment_status_schedule_idx
  on public.reminders (
    clinic_id,
    appointment_id,
    status,
    scheduled_at,
    id
  );

create or replace function public.reconcile_clinic_reminders(
  target_clinic_id uuid,
  target_reference_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled_count integer := 0;
  skipped_count integer := 0;
begin
  if target_clinic_id is null or target_reference_at is null then
    raise exception 'INVALID_REMINDER_RECONCILIATION_ARGUMENTS'
      using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_manage_reminder_queue(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with updated as (
    update public.reminders reminders
    set
      status = 'cancelled',
      metadata = coalesce(reminders.metadata, '{}'::jsonb) ||
        jsonb_build_object('reason', 'appointment_cancelled'),
      updated_at = now()
    from public.appointments appointments
    where reminders.clinic_id = target_clinic_id
      and appointments.clinic_id = reminders.clinic_id
      and appointments.id = reminders.appointment_id
      and reminders.status in ('pending', 'scheduled')
      and appointments.status in ('cancelled', 'completed', 'no_show')
    returning reminders.id
  )
  select count(*) into cancelled_count from updated;

  with updated as (
    update public.reminders reminders
    set
      status = 'skipped',
      metadata = coalesce(reminders.metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'appointment_date', appointments.appointment_date::text,
          'appointment_status', appointments.status,
          'appointment_time', to_char(appointments.start_time, 'HH24:MI'),
          'note', 'La cita ya pasó sin envío del recordatorio.',
          'reason', 'appointment_passed'
        ),
      updated_at = now()
    from public.appointments appointments
    where reminders.clinic_id = target_clinic_id
      and appointments.clinic_id = reminders.clinic_id
      and appointments.id = reminders.appointment_id
      and reminders.status in ('pending', 'scheduled')
      and appointments.status not in ('cancelled', 'completed', 'no_show')
      and appointments.appointment_date + appointments.start_time
        < target_reference_at at time zone 'America/La_Paz'
    returning reminders.id
  )
  select count(*) into skipped_count from updated;

  return jsonb_build_object(
    'cancelledCount', cancelled_count,
    'changed', cancelled_count > 0 or skipped_count > 0,
    'skippedCount', skipped_count
  );
end;
$$;

create or replace function public.get_clinic_reminder_queue_page(
  target_clinic_id uuid,
  target_selected_date date default null,
  target_status text default 'all',
  target_appointment_status text default 'all',
  target_search text default '',
  target_reference_date date default current_date,
  target_reference_time time default localtime,
  target_after_start_time time default null,
  target_after_group_id uuid default null,
  target_page_size integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  effective_selected_date date;
  normalized_search text;
  result_payload jsonb;
  window_start date;
  window_end date;
begin
  if target_clinic_id is null
    or target_reference_date is null
    or target_reference_time is null
    or target_status not in (
      'all', 'pending', 'scheduled', 'sent', 'failed', 'cancelled', 'skipped'
    )
    or target_appointment_status not in (
      'all', 'pending', 'confirmed', 'rescheduled', 'cancelled',
      'completed', 'no_show', 'past_unresolved'
    )
    or target_page_size < 1
    or target_page_size > 20
    or (target_after_start_time is null) <> (target_after_group_id is null) then
    raise exception 'INVALID_REMINDER_QUEUE_PAGE_ARGUMENTS'
      using errcode = '22023';
  end if;

  if auth.uid() is null
    or not public.can_manage_reminder_queue(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  normalized_search := public.normalize_patient_search(target_search);
  window_start := target_reference_date - 7;
  window_end := target_reference_date + 30;

  with reminder_occurrences as materialized (
    select
      reminders.*,
      appointments.status as current_appointment_status,
      appointments.duration_minutes,
      appointments.reason as appointment_reason,
      appointments.reschedule_reason,
      patients.first_name,
      patients.last_name,
      patients.phone,
      coalesce(treatments.name, appointments.reason, 'Tratamiento no registrado')
        as treatment_name,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_date'
        then (reminders.metadata->>'appointment_date')::date
        else appointments.appointment_date
      end as occurrence_date,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_time'
        then (reminders.metadata->>'appointment_time')::time
        else appointments.start_time
      end as occurrence_time,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_status'
        then reminders.metadata->>'appointment_status'
        else appointments.status
      end as occurrence_status
    from public.reminders reminders
    join public.appointments appointments
      on appointments.id = reminders.appointment_id
      and appointments.clinic_id = reminders.clinic_id
    join public.patients patients
      on patients.id = reminders.patient_id
      and patients.clinic_id = reminders.clinic_id
    left join public.treatments treatments
      on treatments.id = appointments.treatment_id
      and treatments.clinic_id = reminders.clinic_id
    where reminders.clinic_id = target_clinic_id
  ),
  window_rows as materialized (
    select reminder_occurrences.*
    from reminder_occurrences
    where reminder_occurrences.occurrence_date between window_start and window_end
  ),
  available_dates as materialized (
    select distinct window_rows.occurrence_date
    from window_rows
  )
  select coalesce(
    (
      select available_dates.occurrence_date
      from available_dates
      where available_dates.occurrence_date = target_selected_date
    ),
    (
      select available_dates.occurrence_date
      from available_dates
      where available_dates.occurrence_date = target_reference_date
    ),
    (
      select min(available_dates.occurrence_date)
      from available_dates
      where available_dates.occurrence_date > target_reference_date
    ),
    (
      select max(available_dates.occurrence_date)
      from available_dates
      where available_dates.occurrence_date < target_reference_date
    )
  ) into effective_selected_date;

  with reminder_occurrences as materialized (
    select
      reminders.*,
      appointments.appointment_date as current_appointment_date,
      appointments.start_time as current_appointment_time,
      appointments.status as current_appointment_status,
      appointments.duration_minutes,
      appointments.reason as appointment_reason,
      appointments.reschedule_reason,
      patients.first_name,
      patients.last_name,
      patients.phone,
      coalesce(treatments.name, appointments.reason, 'Tratamiento no registrado')
        as treatment_name,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_date'
        then (reminders.metadata->>'appointment_date')::date
        else appointments.appointment_date
      end as occurrence_date,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_time'
        then (reminders.metadata->>'appointment_time')::time
        else appointments.start_time
      end as occurrence_time,
      case
        when reminders.status = 'skipped'
          and reminders.metadata->>'reason' = 'appointment_passed'
          and reminders.metadata ? 'appointment_status'
        then reminders.metadata->>'appointment_status'
        else appointments.status
      end as occurrence_status
    from public.reminders reminders
    join public.appointments appointments
      on appointments.id = reminders.appointment_id
      and appointments.clinic_id = reminders.clinic_id
    join public.patients patients
      on patients.id = reminders.patient_id
      and patients.clinic_id = reminders.clinic_id
    left join public.treatments treatments
      on treatments.id = appointments.treatment_id
      and treatments.clinic_id = reminders.clinic_id
    where reminders.clinic_id = target_clinic_id
  ),
  window_rows as materialized (
    select reminder_occurrences.*
    from reminder_occurrences
    where reminder_occurrences.occurrence_date between window_start and window_end
  ),
  matching_rows as materialized (
    select window_rows.*
    from window_rows
    where window_rows.occurrence_date = effective_selected_date
      and (target_status = 'all' or window_rows.status = target_status)
      and (
        target_appointment_status = 'all'
        or window_rows.occurrence_status = target_appointment_status
        or (
          target_appointment_status = 'past_unresolved'
          and window_rows.occurrence_status in ('pending', 'confirmed', 'rescheduled')
          and window_rows.occurrence_date + window_rows.occurrence_time
            < target_reference_date + target_reference_time
        )
      )
      and (
        normalized_search = ''
        or not exists (
          select 1
          from regexp_split_to_table(normalized_search, '\s+') search_token
          where public.normalize_patient_search(
            window_rows.first_name || ' ' || window_rows.last_name || ' ' ||
            window_rows.phone || ' ' || window_rows.treatment_name
          ) not like '%' || search_token || '%'
        )
      )
  ),
  occurrence_groups as materialized (
    select
      matching_rows.appointment_id,
      matching_rows.occurrence_date,
      matching_rows.occurrence_time,
      min(matching_rows.id::text)::uuid as group_id
    from matching_rows
    group by
      matching_rows.appointment_id,
      matching_rows.occurrence_date,
      matching_rows.occurrence_time
  ),
  candidate_groups as materialized (
    select occurrence_groups.*
    from occurrence_groups
    where target_after_start_time is null
      or (occurrence_groups.occurrence_time, occurrence_groups.group_id)
        > (target_after_start_time, target_after_group_id)
    order by occurrence_groups.occurrence_time, occurrence_groups.group_id
    limit target_page_size + 1
  ),
  visible_groups as materialized (
    select candidate_groups.*
    from candidate_groups
    order by candidate_groups.occurrence_time, candidate_groups.group_id
    limit target_page_size
  ),
  visible_rows as materialized (
    select matching_rows.*
    from matching_rows
    join visible_groups
      on visible_groups.appointment_id = matching_rows.appointment_id
      and visible_groups.occurrence_date = matching_rows.occurrence_date
      and visible_groups.occurrence_time = matching_rows.occurrence_time
  )
  select jsonb_build_object(
    'reminders', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', visible_rows.id,
            'appointmentId', visible_rows.appointment_id,
            'patientId', visible_rows.patient_id,
            'patientName', btrim(visible_rows.first_name || ' ' || visible_rows.last_name),
            'phone', visible_rows.phone,
            'appointmentDate', visible_rows.occurrence_date::text,
            'appointmentStatus', visible_rows.occurrence_status,
            'appointmentTime', to_char(visible_rows.occurrence_time, 'HH24:MI'),
            'treatment', visible_rows.treatment_name,
            'rescheduleReason', visible_rows.reschedule_reason,
            'reminderType', visible_rows.reminder_type,
            'scheduledFor', visible_rows.scheduled_at,
            'sentAt', visible_rows.sent_at,
            'failedReason', visible_rows.failed_reason,
            'status', visible_rows.status,
            'statusNote', case
              when visible_rows.status = 'skipped'
                and visible_rows.metadata->>'reason' = 'appointment_passed'
              then 'Omitido porque la cita ya pasó.'
              else null
            end,
            'message', visible_rows.message
          )
          order by
            visible_rows.occurrence_time,
            visible_rows.appointment_id,
            visible_rows.scheduled_at,
            visible_rows.id
        )
        from visible_rows
      ),
      '[]'::jsonb
    ),
    'appointments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', appointment_rows.appointment_id,
            'patientId', appointment_rows.patient_id,
            'date', appointment_rows.current_appointment_date::text,
            'durationMinutes', appointment_rows.duration_minutes,
            'time', to_char(appointment_rows.current_appointment_time, 'HH24:MI'),
            'patient', btrim(appointment_rows.first_name || ' ' || appointment_rows.last_name),
            'patientPhone', appointment_rows.phone,
            'rescheduleReason', appointment_rows.reschedule_reason,
            'treatment', appointment_rows.treatment_name,
            'status', appointment_rows.current_appointment_status
          )
          order by appointment_rows.current_appointment_time, appointment_rows.appointment_id
        )
        from (
          select distinct on (visible_rows.appointment_id)
            visible_rows.*
          from visible_rows
          order by visible_rows.appointment_id
        ) appointment_rows
      ),
      '[]'::jsonb
    ),
    'dateOptions', coalesce(
      (
        select jsonb_agg(date_rows.occurrence_date::text order by date_rows.occurrence_date)
        from (
          select distinct window_rows.occurrence_date
          from window_rows
        ) date_rows
      ),
      '[]'::jsonb
    ),
    'selectedDate', effective_selected_date,
    'summary', jsonb_build_object(
      'total', count(*) filter (where true),
      'pending', count(*) filter (where window_rows.status = 'pending'),
      'scheduled', count(*) filter (where window_rows.status = 'scheduled'),
      'sent', count(*) filter (where window_rows.status = 'sent'),
      'failed', count(*) filter (where window_rows.status = 'failed'),
      'cancelled', count(*) filter (where window_rows.status = 'cancelled'),
      'skipped', count(*) filter (where window_rows.status = 'skipped')
    ),
    'selectedDateSummary', jsonb_build_object(
      'total', count(*) filter (where window_rows.occurrence_date = effective_selected_date),
      'pending', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'pending'
      ),
      'scheduled', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'scheduled'
      ),
      'sent', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'sent'
      ),
      'failed', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'failed'
      ),
      'cancelled', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'cancelled'
      ),
      'skipped', count(*) filter (
        where window_rows.occurrence_date = effective_selected_date
          and window_rows.status = 'skipped'
      )
    ),
    'pageInfo', jsonb_build_object(
      'hasMore', (select count(*) > target_page_size from candidate_groups),
      'nextCursor', case
        when not exists (select 1 from visible_groups) then null
        else (
          select jsonb_build_object(
            'startTime', to_char(visible_groups.occurrence_time, 'HH24:MI'),
            'groupId', visible_groups.group_id
          )
          from visible_groups
          order by visible_groups.occurrence_time desc, visible_groups.group_id desc
          limit 1
        )
      end
    ),
    'window', jsonb_build_object(
      'from', window_start,
      'to', window_end
    )
  )
  into result_payload
  from window_rows;

  return result_payload;
end;
$$;

revoke all on function public.reconcile_clinic_reminders(uuid, timestamptz)
  from public, anon;
grant execute on function public.reconcile_clinic_reminders(uuid, timestamptz)
  to authenticated, service_role;

revoke all on function public.get_clinic_reminder_queue_page(
  uuid, date, text, text, text, date, time, time, uuid, integer
) from public, anon;
grant execute on function public.get_clinic_reminder_queue_page(
  uuid, date, text, text, text, date, time, time, uuid, integer
) to authenticated, service_role;

comment on function public.reconcile_clinic_reminders(uuid, timestamptz) is
  'Atomically closes mutable reminders whose appointments are terminal or past.';

comment on function public.get_clinic_reminder_queue_page(
  uuid, date, text, text, text, date, time, time, uuid, integer
) is
  'Returns one authorized reminder page within a 7-day past and 30-day future window.';
