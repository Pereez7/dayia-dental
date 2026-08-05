-- PERF-005B2: serialize appointment scheduling and keep its audit log atomic.

create index if not exists appointments_active_patient_day_idx
  on public.appointments (clinic_id, patient_id, appointment_date)
  where status in ('pending', 'confirmed', 'rescheduled');

create index if not exists appointments_active_clinic_day_time_idx
  on public.appointments (
    clinic_id,
    appointment_date,
    start_time
  )
  include (duration_minutes)
  where status in ('pending', 'confirmed', 'rescheduled');

create or replace function public.assert_clinic_appointment_slot(
  target_clinic_id uuid,
  target_patient_id uuid,
  target_date date,
  target_start_time time,
  target_duration_minutes integer,
  target_appointment_id_to_ignore uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_is_open boolean;
  schedule_start_time time;
  schedule_end_time time;
  schedule_interval_minutes integer;
  exception_type text;
  exception_start_time time;
  exception_end_time time;
  slot_offset_minutes integer;
begin
  if target_clinic_id is null
    or target_patient_id is null
    or target_date is null
    or target_start_time is null
    or target_duration_minutes is null
    or target_duration_minutes <= 0
    or target_duration_minutes > 480 then
    raise exception 'APPOINTMENT_INVALID_INPUT' using errcode = '22023';
  end if;

  if not public.can_access_clinic_data(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Every create or reschedule targeting the same clinic-day is serialized.
  -- The lock is released automatically at the end of the transaction.
  perform pg_advisory_xact_lock(
    hashtextextended(
      target_clinic_id::text || ':' || target_date::text,
      0
    )
  );

  select
    hours.is_open,
    hours.start_time,
    hours.end_time,
    hours.slot_interval_minutes
  into
    schedule_is_open,
    schedule_start_time,
    schedule_end_time,
    schedule_interval_minutes
  from public.business_hours hours
  where hours.clinic_id = target_clinic_id
    and hours.weekday = extract(dow from target_date)::integer;

  if not found then
    raise exception 'APPOINTMENT_SCHEDULE_NOT_CONFIGURED'
      using errcode = 'P0001';
  end if;

  select
    exceptions.type,
    exceptions.start_time,
    exceptions.end_time
  into
    exception_type,
    exception_start_time,
    exception_end_time
  from public.calendar_exceptions exceptions
  where exceptions.clinic_id = target_clinic_id
    and exceptions.date = target_date;

  if found then
    if exception_type = 'closed' then
      raise exception 'APPOINTMENT_CLOSED_DAY' using errcode = 'P0001';
    end if;

    schedule_is_open := true;
    schedule_start_time := exception_start_time;
    schedule_end_time := exception_end_time;
  end if;

  if schedule_is_open is not true
    or schedule_start_time is null
    or schedule_end_time is null then
    raise exception 'APPOINTMENT_CLOSED_DAY' using errcode = 'P0001';
  end if;

  if target_start_time < schedule_start_time
    or target_start_time + make_interval(mins => target_duration_minutes)
      > schedule_end_time then
    raise exception 'APPOINTMENT_OUTSIDE_BUSINESS_HOURS'
      using errcode = 'P0001';
  end if;

  slot_offset_minutes := (
    extract(epoch from (target_start_time - schedule_start_time)) / 60
  )::integer;

  if schedule_interval_minutes is null
    or schedule_interval_minutes <= 0
    or mod(slot_offset_minutes, schedule_interval_minutes) <> 0 then
    raise exception 'APPOINTMENT_INVALID_SLOT' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.appointments appointments
    where appointments.clinic_id = target_clinic_id
      and appointments.patient_id = target_patient_id
      and appointments.appointment_date = target_date
      and appointments.status in ('pending', 'confirmed', 'rescheduled')
      and (
        target_appointment_id_to_ignore is null
        or appointments.id <> target_appointment_id_to_ignore
      )
  ) then
    raise exception 'APPOINTMENT_PATIENT_DAY_CONFLICT'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.appointments appointments
    where appointments.clinic_id = target_clinic_id
      and appointments.appointment_date = target_date
      and appointments.status in ('pending', 'confirmed', 'rescheduled')
      and (
        target_appointment_id_to_ignore is null
        or appointments.id <> target_appointment_id_to_ignore
      )
      and appointments.start_time
        < target_start_time + make_interval(mins => target_duration_minutes)
      and appointments.start_time
        + make_interval(mins => appointments.duration_minutes)
        > target_start_time
  ) then
    raise exception 'APPOINTMENT_SLOT_CONFLICT' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_clinic_appointment(
  target_clinic_id uuid,
  target_patient_id uuid,
  target_treatment_id uuid,
  target_date date,
  target_start_time time,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  treatment_row public.treatments%rowtype;
  appointment_row public.appointments%rowtype;
  log_row public.appointment_change_logs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if target_status not in ('pending', 'confirmed') then
    raise exception 'APPOINTMENT_INVALID_STATUS' using errcode = '22023';
  end if;

  if not public.can_write_appointment(
    target_clinic_id,
    target_patient_id,
    target_treatment_id
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select treatments.*
  into treatment_row
  from public.treatments treatments
  where treatments.id = target_treatment_id
    and treatments.clinic_id = target_clinic_id
    and treatments.is_active = true;

  if not found then
    raise exception 'APPOINTMENT_INVALID_TREATMENT' using errcode = 'P0001';
  end if;

  perform public.assert_clinic_appointment_slot(
    target_clinic_id,
    target_patient_id,
    target_date,
    target_start_time,
    treatment_row.duration_minutes,
    null
  );

  insert into public.appointments (
    clinic_id,
    patient_id,
    treatment_id,
    appointment_date,
    start_time,
    duration_minutes,
    status,
    reason
  )
  values (
    target_clinic_id,
    target_patient_id,
    treatment_row.id,
    target_date,
    target_start_time,
    treatment_row.duration_minutes,
    target_status,
    treatment_row.name
  )
  returning * into appointment_row;

  insert into public.appointment_change_logs (
    clinic_id,
    appointment_id,
    type,
    description,
    to_date,
    to_time
  )
  values (
    target_clinic_id,
    appointment_row.id,
    'created',
    format(
      'Cita creada para el %s a las %s.',
      target_date,
      to_char(target_start_time, 'HH24:MI')
    ),
    target_date,
    target_start_time
  )
  returning * into log_row;

  return jsonb_build_object(
    'appointment', to_jsonb(appointment_row),
    'changeLog', to_jsonb(log_row)
  );
end;
$$;

create or replace function public.reschedule_clinic_appointment(
  target_clinic_id uuid,
  target_appointment_id uuid,
  target_expected_date date,
  target_expected_start_time time,
  target_date date,
  target_start_time time,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  updated_appointment_row public.appointments%rowtype;
  log_row public.appointment_change_logs%rowtype;
  normalized_reason text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not public.can_access_clinic_data(target_clinic_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  normalized_reason := btrim(coalesce(target_reason, ''));

  if normalized_reason = '' or char_length(normalized_reason) > 120 then
    raise exception 'APPOINTMENT_INVALID_REASON' using errcode = '22023';
  end if;

  select appointments.*
  into appointment_row
  from public.appointments appointments
  where appointments.id = target_appointment_id
    and appointments.clinic_id = target_clinic_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if appointment_row.status not in ('pending', 'confirmed', 'rescheduled') then
    raise exception 'APPOINTMENT_CANNOT_RESCHEDULE' using errcode = 'P0001';
  end if;

  if appointment_row.appointment_date <> target_expected_date
    or appointment_row.start_time <> target_expected_start_time then
    raise exception 'APPOINTMENT_STALE' using errcode = 'P0001';
  end if;

  if appointment_row.appointment_date = target_date
    and appointment_row.start_time = target_start_time then
    raise exception 'APPOINTMENT_NO_SCHEDULE_CHANGE' using errcode = 'P0001';
  end if;

  perform public.assert_clinic_appointment_slot(
    target_clinic_id,
    appointment_row.patient_id,
    target_date,
    target_start_time,
    appointment_row.duration_minutes,
    appointment_row.id
  );

  update public.appointments appointments
  set
    appointment_date = target_date,
    start_time = target_start_time,
    status = 'rescheduled',
    reschedule_reason = normalized_reason
  where appointments.id = appointment_row.id
    and appointments.clinic_id = target_clinic_id
  returning * into updated_appointment_row;

  insert into public.appointment_change_logs (
    clinic_id,
    appointment_id,
    type,
    description,
    from_date,
    from_time,
    to_date,
    to_time
  )
  values (
    target_clinic_id,
    appointment_row.id,
    'rescheduled',
    format(
      'Cita reprogramada del %s a las %s al %s a las %s. Motivo: %s.',
      appointment_row.appointment_date,
      to_char(appointment_row.start_time, 'HH24:MI'),
      target_date,
      to_char(target_start_time, 'HH24:MI'),
      normalized_reason
    ),
    appointment_row.appointment_date,
    appointment_row.start_time,
    target_date,
    target_start_time
  )
  returning * into log_row;

  return jsonb_build_object(
    'appointment', to_jsonb(updated_appointment_row),
    'changeLog', to_jsonb(log_row)
  );
end;
$$;

-- Scheduling writes must use the transactional RPCs. Status-only updates keep
-- their existing path until their own lifecycle subhito is migrated.
revoke insert (
  clinic_id,
  patient_id,
  treatment_id,
  appointment_date,
  start_time,
  duration_minutes,
  status,
  reason,
  cancel_reason,
  reschedule_reason
) on table public.appointments from authenticated;

revoke update (
  patient_id,
  treatment_id,
  appointment_date,
  start_time,
  duration_minutes,
  reason,
  reschedule_reason
) on table public.appointments from authenticated;

revoke all on function public.assert_clinic_appointment_slot(
  uuid, uuid, date, time, integer, uuid
) from public, anon, authenticated;

revoke all on function public.create_clinic_appointment(
  uuid, uuid, uuid, date, time, text
) from public, anon;
grant execute on function public.create_clinic_appointment(
  uuid, uuid, uuid, date, time, text
) to authenticated;

revoke all on function public.reschedule_clinic_appointment(
  uuid, uuid, date, time, date, time, text
) from public, anon;
grant execute on function public.reschedule_clinic_appointment(
  uuid, uuid, date, time, date, time, text
) to authenticated;

comment on function public.create_clinic_appointment(
  uuid, uuid, uuid, date, time, text
) is
  'Creates a clinic appointment and its audit entry atomically after serialized availability validation.';

comment on function public.reschedule_clinic_appointment(
  uuid, uuid, date, time, date, time, text
) is
  'Reschedules an unchanged active appointment and appends its audit entry atomically after serialized availability validation.';
