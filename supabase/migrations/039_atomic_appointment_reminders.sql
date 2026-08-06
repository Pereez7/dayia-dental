-- PERF-005E follow-up: synchronize reminder rows inside appointment writes.

create or replace function public.build_clinic_reminder_message(
  target_patient_first_name text,
  target_treatment_name text,
  target_appointment_date date,
  target_appointment_time time,
  target_reminder_type text,
  target_appointment_status text,
  target_reference_date date
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  date_label text;
  patient_label text;
  treatment_label text;
begin
  patient_label := coalesce(nullif(btrim(target_patient_first_name), ''), 'Paciente');
  treatment_label := coalesce(nullif(btrim(target_treatment_name), ''), 'tu atención');

  date_label := case
    when target_appointment_date = target_reference_date then 'hoy'
    when target_appointment_date = target_reference_date + 1 then 'mañana'
    else format(
      'el %s de %s',
      extract(day from target_appointment_date)::integer,
      case extract(month from target_appointment_date)::integer
        when 1 then 'enero'
        when 2 then 'febrero'
        when 3 then 'marzo'
        when 4 then 'abril'
        when 5 then 'mayo'
        when 6 then 'junio'
        when 7 then 'julio'
        when 8 then 'agosto'
        when 9 then 'septiembre'
        when 10 then 'octubre'
        when 11 then 'noviembre'
        else 'diciembre'
      end
    )
  end;

  if target_appointment_status = 'confirmed' then
    return format(
      'Hola %s, te recordamos tu cita odontológica confirmada para %s %s a las %s.',
      patient_label,
      treatment_label,
      date_label,
      to_char(target_appointment_time, 'HH24:MI')
    );
  end if;

  if target_appointment_status = 'rescheduled' then
    return format(
      'Hola %s, te recordamos que tu cita fue reprogramada para %s %s a las %s. Por favor confirma tu asistencia.',
      patient_label,
      treatment_label,
      date_label,
      to_char(target_appointment_time, 'HH24:MI')
    );
  end if;

  if target_reminder_type <> 'immediate' then
    return format(
      'Hola %s, te recordamos tu cita odontológica para %s %s a las %s. Por favor confirma tu asistencia.',
      patient_label,
      treatment_label,
      date_label,
      to_char(target_appointment_time, 'HH24:MI')
    );
  end if;

  return format(
    'Hola %s, te recordamos que tienes una cita odontológica para %s %s a las %s. Por favor confirma tu asistencia.',
    patient_label,
    treatment_label,
    date_label,
    to_char(target_appointment_time, 'HH24:MI')
  );
end;
$$;

create or replace function public.sync_appointment_reminders_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_at timestamptz;
  active_reminder_count integer := 0;
  patient_first_name text;
  patient_phone text;
  reference_at timestamptz := now();
  reference_date date := timezone('America/La_Paz', now())::date;
  should_generate boolean := false;
  treatment_name text;
begin
  -- Current production appointment writes always use an active treatment.
  -- Legacy rows without treatment_id remain untouched by this trigger.
  if new.treatment_id is null then
    return new;
  end if;

  select
    patients.first_name,
    patients.phone,
    treatments.name
  into
    patient_first_name,
    patient_phone,
    treatment_name
  from public.patients patients
  join public.treatments treatments
    on treatments.id = new.treatment_id
    and treatments.clinic_id = new.clinic_id
  where patients.id = new.patient_id
    and patients.clinic_id = new.clinic_id;

  if not found then
    raise exception 'APPOINTMENT_REMINDER_CONTEXT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    should_generate := new.status in ('pending', 'confirmed', 'rescheduled');
  else
    if new.appointment_date is distinct from old.appointment_date
      or new.start_time is distinct from old.start_time
      or new.patient_id is distinct from old.patient_id
      or new.treatment_id is distinct from old.treatment_id then
      update public.reminders reminders
      set
        status = 'cancelled',
        metadata = coalesce(reminders.metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'appointment_date', old.appointment_date::text,
            'appointment_status', old.status,
            'appointment_time', to_char(old.start_time, 'HH24:MI'),
            'reason', 'appointment_rescheduled'
          ),
        updated_at = now()
      where reminders.clinic_id = old.clinic_id
        and reminders.appointment_id = old.id
        and reminders.status in ('pending', 'scheduled');

      should_generate := new.status in ('pending', 'confirmed', 'rescheduled');
    elsif new.status in ('cancelled', 'completed', 'no_show') then
      update public.reminders reminders
      set
        status = 'cancelled',
        metadata = coalesce(reminders.metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'appointment_date', new.appointment_date::text,
            'appointment_status', new.status,
            'appointment_time', to_char(new.start_time, 'HH24:MI'),
            'reason', 'appointment_terminal'
          ),
        updated_at = now()
      where reminders.clinic_id = new.clinic_id
        and reminders.appointment_id = new.id
        and reminders.status in ('pending', 'scheduled');

      return new;
    elsif new.status is distinct from old.status then
      update public.reminders reminders
      set
        message = public.build_clinic_reminder_message(
          patient_first_name,
          treatment_name,
          new.appointment_date,
          new.start_time,
          reminders.reminder_type,
          new.status,
          reference_date
        ),
        updated_at = now()
      where reminders.clinic_id = new.clinic_id
        and reminders.appointment_id = new.id
        and reminders.status in ('pending', 'scheduled');

      get diagnostics active_reminder_count = row_count;
      should_generate := new.status in ('pending', 'confirmed', 'rescheduled')
        and active_reminder_count = 0
        and nullif(btrim(coalesce(patient_phone, '')), '') is not null
        and (
          old.status in ('cancelled', 'completed', 'no_show')
          or not exists (
            select 1
            from public.reminders reminders
            where reminders.clinic_id = new.clinic_id
              and reminders.appointment_id = new.id
          )
        );
    else
      select count(*)
      into active_reminder_count
      from public.reminders reminders
      where reminders.clinic_id = new.clinic_id
        and reminders.appointment_id = new.id;

      should_generate := new.status in ('pending', 'confirmed', 'rescheduled')
        and active_reminder_count = 0;
    end if;
  end if;

  if not should_generate then
    return new;
  end if;

  appointment_at := (new.appointment_date + new.start_time)
    at time zone 'America/La_Paz';

  if appointment_at <= reference_at then
    return new;
  end if;

  if appointment_at - interval '24 hours' > reference_at then
    insert into public.reminders (
      clinic_id, appointment_id, patient_id, channel, scheduled_at, status,
      message, reminder_type, metadata
    ) values (
      new.clinic_id,
      new.id,
      new.patient_id,
      'whatsapp',
      appointment_at - interval '24 hours',
      case
        when nullif(btrim(coalesce(patient_phone, '')), '') is null then 'skipped'
        else 'scheduled'
      end,
      public.build_clinic_reminder_message(
        patient_first_name,
        treatment_name,
        new.appointment_date,
        new.start_time,
        '24h',
        new.status,
        reference_date
      ),
      '24h',
      '{}'::jsonb
    );
  end if;

  if appointment_at - interval '2 hours' > reference_at then
    insert into public.reminders (
      clinic_id, appointment_id, patient_id, channel, scheduled_at, status,
      message, reminder_type, metadata
    ) values (
      new.clinic_id,
      new.id,
      new.patient_id,
      'whatsapp',
      appointment_at - interval '2 hours',
      case
        when nullif(btrim(coalesce(patient_phone, '')), '') is null then 'skipped'
        else 'pending'
      end,
      public.build_clinic_reminder_message(
        patient_first_name,
        treatment_name,
        new.appointment_date,
        new.start_time,
        '2h',
        new.status,
        reference_date
      ),
      '2h',
      '{}'::jsonb
    );
  end if;

  if appointment_at - interval '2 hours' <= reference_at then
    insert into public.reminders (
      clinic_id, appointment_id, patient_id, channel, scheduled_at, status,
      message, reminder_type, metadata
    ) values (
      new.clinic_id,
      new.id,
      new.patient_id,
      'whatsapp',
      reference_at,
      case
        when nullif(btrim(coalesce(patient_phone, '')), '') is null then 'skipped'
        else 'pending'
      end,
      public.build_clinic_reminder_message(
        patient_first_name,
        treatment_name,
        new.appointment_date,
        new.start_time,
        'immediate',
        new.status,
        reference_date
      ),
      'immediate',
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_appointment_reminders_after_write
  on public.appointments;
create trigger sync_appointment_reminders_after_write
after insert or update of
  appointment_date, start_time, patient_id, treatment_id, status
on public.appointments
for each row
execute function public.sync_appointment_reminders_after_write();

-- Repair active future appointments created while reminder generation still
-- depended on the frontend patient collection. Setting status to itself fires
-- only the synchronization trigger and preserves the appointment audit trail.
update public.appointments appointments
set status = appointments.status
where appointments.treatment_id is not null
  and appointments.status in ('pending', 'confirmed', 'rescheduled')
  and appointments.appointment_date + appointments.start_time
    > timezone('America/La_Paz', now())
  and not exists (
    select 1
    from public.reminders reminders
    where reminders.clinic_id = appointments.clinic_id
      and reminders.appointment_id = appointments.id
  );

revoke all on function public.build_clinic_reminder_message(
  text, text, date, time, text, text, date
) from public, anon, authenticated;
revoke all on function public.sync_appointment_reminders_after_write()
  from public, anon, authenticated;

comment on function public.sync_appointment_reminders_after_write() is
  'Synchronizes reminder lifecycle atomically with real appointment writes; never depends on frontend patient collections.';

comment on trigger sync_appointment_reminders_after_write
  on public.appointments is
  'Creates, refreshes or cancels reminder rows in the same transaction as an appointment write.';
