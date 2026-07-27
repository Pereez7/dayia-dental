-- Membership-based RLS hardening for clinic operational data.
--
-- Security goals:
-- 1. Remove the legacy profiles.clinic_id authorization path.
-- 2. Require an active clinic membership and valid subscription access.
-- 3. Match database permissions to the clinical role matrix.
-- 4. Prevent cross-clinic relationships and client-controlled audit fields.
-- 5. Keep platform administration behind trusted service-role Edge Functions.

create or replace function public.can_access_clinic_data(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = target_clinic_id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
        and memberships.role in (
          'clinic_owner', 'clinic_admin', 'doctor', 'receptionist'
        )
    )
    and exists (
      select 1
      from public.clinics clinics
      where clinics.id = target_clinic_id
        and coalesce(clinics.status, 'active') = 'active'
    )
    and public.subscription_allows_clinical_access(target_clinic_id);
$$;

create or replace function public.can_manage_clinic_settings(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = target_clinic_id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
        and memberships.role in ('clinic_owner', 'clinic_admin')
    );
$$;

create or replace function public.can_manage_team_for_clinic(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_clinic_settings(target_clinic_id)
    and exists (
      select 1
      from public.clinic_subscriptions subscriptions
      join public.plans plans
        on plans.id = subscriptions.plan_id
      where subscriptions.clinic_id = target_clinic_id
        and plans.is_active = true
        and plans.can_manage_team = true
    );
$$;

create or replace function public.can_manage_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_team_for_clinic(
    public.current_user_active_clinic_id()
  );
$$;

create or replace function public.can_manage_whatsapp_for_clinic(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_clinic_settings(target_clinic_id)
    and exists (
      select 1
      from public.clinic_subscriptions subscriptions
      join public.plans plans
        on plans.id = subscriptions.plan_id
      where subscriptions.clinic_id = target_clinic_id
        and plans.is_active = true
        and (
          plans.can_use_whatsapp_automation = true
          or subscriptions.is_lifetime = true
          or subscriptions.status = 'lifetime'
        )
    );
$$;

create or replace function public.can_read_managed_profile(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships target_membership
    where target_membership.user_id = target_user_id
      and public.can_manage_team_for_clinic(
        target_membership.clinic_id
      )
  );
$$;

create or replace function public.can_write_appointment(
  target_clinic_id uuid,
  target_patient_id uuid,
  target_treatment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.patients patients
      where patients.id = target_patient_id
        and patients.clinic_id = target_clinic_id
    )
    and (
      target_treatment_id is null
      or exists (
        select 1
        from public.treatments treatments
        where treatments.id = target_treatment_id
          and treatments.clinic_id = target_clinic_id
      )
    );
$$;

create or replace function public.can_write_appointment_change_log(
  target_clinic_id uuid,
  target_appointment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.appointments appointments
      where appointments.id = target_appointment_id
        and appointments.clinic_id = target_clinic_id
    );
$$;

create or replace function public.can_write_reminder(
  target_clinic_id uuid,
  target_appointment_id uuid,
  target_patient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.appointments appointments
      join public.patients patients
        on patients.id = appointments.patient_id
        and patients.clinic_id = appointments.clinic_id
      where appointments.id = target_appointment_id
        and appointments.clinic_id = target_clinic_id
        and appointments.patient_id = target_patient_id
    );
$$;

create or replace function public.can_manage_reminder_queue(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = target_clinic_id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
        and memberships.role in (
          'clinic_owner', 'clinic_admin', 'receptionist'
        )
    );
$$;

create or replace function public.can_sync_appointment_reminders(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.clinic_id = target_clinic_id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
        and memberships.role = 'doctor'
    );
$$;

-- Clinical access must also stop when the clinic or subscription loses access.
create or replace function public.can_access_clinical_records(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinic_data(target_clinic_id)
    and exists (
      select 1
      from public.clinic_memberships memberships
      where memberships.user_id = auth.uid()
        and memberships.clinic_id = target_clinic_id
        and memberships.status = 'active'
        and memberships.role in ('clinic_owner', 'clinic_admin', 'doctor')
    );
$$;

create or replace function public.can_access_odontogram(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_clinical_records(target_clinic_id);
$$;

-- Authenticated users may only backfill their own missing profile email with
-- the verified email carried by the JWT. Trusted service-role flows may still
-- perform owner-email migrations and activation updates.
create or replace function public.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_email text;
  previous_email text;
begin
  if auth.role() = 'authenticated' then
    if new.id is distinct from old.id
      or new.clinic_id is distinct from old.clinic_id
      or new.role is distinct from old.role
      or new.is_platform_admin is distinct from old.is_platform_admin
      or new.is_active is distinct from old.is_active
      or new.invited_at is distinct from old.invited_at
      or new.activated_at is distinct from old.activated_at
      or new.created_at is distinct from old.created_at then
      raise exception 'PROFILE_PROTECTED_FIELDS';
    end if;

    if new.email is distinct from old.email then
      jwt_email := lower(nullif(btrim(auth.jwt() ->> 'email'), ''));
      previous_email := lower(nullif(btrim(old.email), ''));

      if previous_email is not null
        or jwt_email is null
        or lower(nullif(btrim(new.email), '')) is distinct from jwt_email then
        raise exception 'PROFILE_EMAIL_CHANGE_FORBIDDEN';
      end if;

      new.email := jwt_email;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_update
  on public.profiles;
create trigger protect_profile_update
before update on public.profiles
for each row execute function public.protect_profile_update();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_patients_updated_at on public.patients;
create trigger touch_patients_updated_at
before update on public.patients
for each row execute function public.touch_updated_at();

drop trigger if exists touch_treatments_updated_at on public.treatments;
create trigger touch_treatments_updated_at
before update on public.treatments
for each row execute function public.touch_updated_at();

drop trigger if exists touch_business_hours_updated_at
  on public.business_hours;
create trigger touch_business_hours_updated_at
before update on public.business_hours
for each row execute function public.touch_updated_at();

drop trigger if exists touch_calendar_exceptions_updated_at
  on public.calendar_exceptions;
create trigger touch_calendar_exceptions_updated_at
before update on public.calendar_exceptions
for each row execute function public.touch_updated_at();

drop trigger if exists touch_appointments_updated_at on public.appointments;
create trigger touch_appointments_updated_at
before update on public.appointments
for each row execute function public.touch_updated_at();

drop trigger if exists touch_reminders_updated_at on public.reminders;
create trigger touch_reminders_updated_at
before update on public.reminders
for each row execute function public.touch_updated_at();

drop trigger if exists touch_whatsapp_settings_updated_at
  on public.whatsapp_settings;
create trigger touch_whatsapp_settings_updated_at
before update on public.whatsapp_settings
for each row execute function public.touch_updated_at();

-- New functions are callable only where client-side RLS evaluation requires it.
revoke all on function public.can_access_clinic_data(uuid)
  from public, anon;
revoke all on function public.can_manage_clinic_settings(uuid)
  from public, anon;
revoke all on function public.can_manage_team_for_clinic(uuid)
  from public, anon;
revoke all on function public.can_manage_team()
  from public, anon;
revoke all on function public.can_manage_whatsapp_for_clinic(uuid)
  from public, anon;
revoke all on function public.can_read_managed_profile(uuid)
  from public, anon;
revoke all on function public.can_write_appointment(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.can_write_appointment_change_log(uuid, uuid)
  from public, anon;
revoke all on function public.can_write_reminder(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.can_manage_reminder_queue(uuid)
  from public, anon;
revoke all on function public.can_sync_appointment_reminders(uuid)
  from public, anon;
revoke all on function public.protect_profile_update()
  from public, anon, authenticated;
revoke all on function public.touch_updated_at()
  from public, anon, authenticated;

grant execute on function public.can_access_clinic_data(uuid)
  to authenticated, service_role;
grant execute on function public.can_manage_clinic_settings(uuid)
  to authenticated, service_role;
grant execute on function public.can_manage_team_for_clinic(uuid)
  to authenticated, service_role;
grant execute on function public.can_manage_team()
  to authenticated, service_role;
grant execute on function public.can_manage_whatsapp_for_clinic(uuid)
  to authenticated, service_role;
grant execute on function public.can_read_managed_profile(uuid)
  to authenticated, service_role;
grant execute on function public.can_write_appointment(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.can_write_appointment_change_log(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.can_write_reminder(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.can_manage_reminder_queue(uuid)
  to authenticated, service_role;
grant execute on function public.can_sync_appointment_reminders(uuid)
  to authenticated, service_role;

-- Explicit table privileges prevent API clients from selecting a permitted row
-- and then mutating its tenant id, identity or audit timestamps.
revoke all privileges on table public.clinics
  from public, anon, authenticated;
revoke all privileges on table public.profiles
  from public, anon, authenticated;
revoke all privileges on table public.patients
  from public, anon, authenticated;
revoke all privileges on table public.treatments
  from public, anon, authenticated;
revoke all privileges on table public.business_hours
  from public, anon, authenticated;
revoke all privileges on table public.calendar_exceptions
  from public, anon, authenticated;
revoke all privileges on table public.appointments
  from public, anon, authenticated;
revoke all privileges on table public.appointment_change_logs
  from public, anon, authenticated;
revoke all privileges on table public.reminders
  from public, anon, authenticated;
revoke all privileges on table public.whatsapp_settings
  from public, anon, authenticated;
revoke all privileges on table public.clinical_records
  from public, anon, authenticated;
revoke all privileges on table public.odontogram_entries
  from public, anon, authenticated;

grant select on table public.clinics to authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, email)
  on table public.profiles to authenticated;

grant select on table public.patients to authenticated;
grant insert (
  clinic_id, first_name, last_name, phone, country_code, email,
  birth_date, notes
) on table public.patients to authenticated;
grant update (
  first_name, last_name, phone, country_code, email, birth_date, notes
) on table public.patients to authenticated;

grant select on table public.treatments to authenticated;
grant insert (clinic_id, name, duration_minutes, is_active)
  on table public.treatments to authenticated;
grant update (name, duration_minutes, is_active)
  on table public.treatments to authenticated;

grant select on table public.business_hours to authenticated;
grant insert (
  clinic_id, weekday, is_open, start_time, end_time,
  slot_interval_minutes
) on table public.business_hours to authenticated;
grant update (
  is_open, start_time, end_time, slot_interval_minutes
) on table public.business_hours to authenticated;

grant select on table public.calendar_exceptions to authenticated;
grant insert (
  clinic_id, date, type, start_time, end_time, reason, reason_detail
) on table public.calendar_exceptions to authenticated;
grant update (
  date, type, start_time, end_time, reason, reason_detail
) on table public.calendar_exceptions to authenticated;
-- Temporary compatibility: the current settings UI still deletes calendar
-- exceptions. A later lifecycle migration will replace this with cancellation.
grant delete on table public.calendar_exceptions to authenticated;

grant select on table public.appointments to authenticated;
grant insert (
  clinic_id, patient_id, treatment_id, appointment_date, start_time,
  duration_minutes, status, reason, cancel_reason, reschedule_reason
) on table public.appointments to authenticated;
grant update (
  patient_id, treatment_id, appointment_date, start_time, duration_minutes,
  status, reason, cancel_reason, reschedule_reason
) on table public.appointments to authenticated;

grant select on table public.appointment_change_logs to authenticated;
grant insert (
  clinic_id, appointment_id, type, description,
  from_date, from_time, to_date, to_time
) on table public.appointment_change_logs to authenticated;

grant select on table public.reminders to authenticated;
grant insert (
  clinic_id, appointment_id, patient_id, channel, scheduled_at, status,
  message, metadata
) on table public.reminders to authenticated;
grant update (
  scheduled_at, status, message, sent_at, failed_reason, metadata
) on table public.reminders to authenticated;

grant select on table public.whatsapp_settings to authenticated;
grant insert (
  clinic_id, provider, phone_number, phone_number_id, business_account_id
) on table public.whatsapp_settings to authenticated;
grant update (
  provider, phone_number, phone_number_id, business_account_id
) on table public.whatsapp_settings to authenticated;

grant select on table public.clinical_records to authenticated;
grant insert (
  clinic_id, patient_id, created_by, record_date, reason, diagnosis,
  treatment, observations
) on table public.clinical_records to authenticated;
grant update (
  record_date, reason, diagnosis, treatment, observations
) on table public.clinical_records to authenticated;

grant select on table public.odontogram_entries to authenticated;
grant insert (
  clinic_id, patient_id, tooth_code, surface, status, notes,
  created_by, updated_by
) on table public.odontogram_entries to authenticated;
grant update (status, notes)
  on table public.odontogram_entries to authenticated;

-- Legacy OR-combined policies must be removed before the new policies are
-- added, otherwise PostgreSQL would continue granting their broader access.
drop policy if exists "profiles_select_same_clinic" on public.profiles;
drop policy if exists "clinic members can read clinic profiles"
  on public.profiles;
drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "team managers can read managed profiles"
on public.profiles
for select
to authenticated
using (public.can_read_managed_profile(id));

create policy "users can update safe own profile fields"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "clinic members can read own clinic"
  on public.clinics;
create policy "active members can read clinic context"
on public.clinics
for select
to authenticated
using (public.is_active_member(id));

drop policy if exists "clinic members can manage patients"
  on public.patients;
create policy "active clinic roles can read patients"
on public.patients
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "active clinic roles can create patients"
on public.patients
for insert
to authenticated
with check (public.can_access_clinic_data(clinic_id));
create policy "active clinic roles can update patients"
on public.patients
for update
to authenticated
using (public.can_access_clinic_data(clinic_id))
with check (public.can_access_clinic_data(clinic_id));

drop policy if exists "clinic members can manage treatments"
  on public.treatments;
create policy "active clinic roles can read treatments"
on public.treatments
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "clinic managers can create treatments"
on public.treatments
for insert
to authenticated
with check (public.can_manage_clinic_settings(clinic_id));
create policy "clinic managers can update treatments"
on public.treatments
for update
to authenticated
using (public.can_manage_clinic_settings(clinic_id))
with check (public.can_manage_clinic_settings(clinic_id));

drop policy if exists "clinic members can manage business hours"
  on public.business_hours;
create policy "active clinic roles can read business hours"
on public.business_hours
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "clinic managers can create business hours"
on public.business_hours
for insert
to authenticated
with check (public.can_manage_clinic_settings(clinic_id));
create policy "clinic managers can update business hours"
on public.business_hours
for update
to authenticated
using (public.can_manage_clinic_settings(clinic_id))
with check (public.can_manage_clinic_settings(clinic_id));

drop policy if exists "clinic members can manage calendar exceptions"
  on public.calendar_exceptions;
create policy "active clinic roles can read calendar exceptions"
on public.calendar_exceptions
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "clinic managers can create calendar exceptions"
on public.calendar_exceptions
for insert
to authenticated
with check (public.can_manage_clinic_settings(clinic_id));
create policy "clinic managers can update calendar exceptions"
on public.calendar_exceptions
for update
to authenticated
using (public.can_manage_clinic_settings(clinic_id))
with check (public.can_manage_clinic_settings(clinic_id));
create policy "clinic managers can delete calendar exceptions"
on public.calendar_exceptions
for delete
to authenticated
using (public.can_manage_clinic_settings(clinic_id));

drop policy if exists "clinic members can manage appointments"
  on public.appointments;
create policy "active clinic roles can read appointments"
on public.appointments
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "active clinic roles can create appointments"
on public.appointments
for insert
to authenticated
with check (
  public.can_write_appointment(clinic_id, patient_id, treatment_id)
);
create policy "active clinic roles can update appointments"
on public.appointments
for update
to authenticated
using (public.can_access_clinic_data(clinic_id))
with check (
  public.can_write_appointment(clinic_id, patient_id, treatment_id)
);

drop policy if exists "clinic members can manage appointment change logs"
  on public.appointment_change_logs;
create policy "active clinic roles can read appointment change logs"
on public.appointment_change_logs
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "active clinic roles can create appointment change logs"
on public.appointment_change_logs
for insert
to authenticated
with check (
  public.can_write_appointment_change_log(clinic_id, appointment_id)
);

drop policy if exists "clinic members can manage reminders"
  on public.reminders;
create policy "active clinic roles can read reminders"
on public.reminders
for select
to authenticated
using (public.can_access_clinic_data(clinic_id));
create policy "active clinic roles can create reminders"
on public.reminders
for insert
to authenticated
with check (
  public.can_write_reminder(clinic_id, appointment_id, patient_id)
  and status in ('pending', 'scheduled', 'skipped')
  and sent_at is null
  and failed_reason is null
  and provider_message_id is null
  and delivered_at is null
  and read_at is null
);
create policy "reminder managers can update reminders"
on public.reminders
for update
to authenticated
using (
  public.can_manage_reminder_queue(clinic_id)
  and public.can_write_reminder(clinic_id, appointment_id, patient_id)
)
with check (
  public.can_manage_reminder_queue(clinic_id)
  and
  public.can_write_reminder(clinic_id, appointment_id, patient_id)
);
create policy "doctors can sync appointment reminders"
on public.reminders
for update
to authenticated
using (
  public.can_sync_appointment_reminders(clinic_id)
  and public.can_write_reminder(clinic_id, appointment_id, patient_id)
  and status in ('pending', 'scheduled')
)
with check (
  public.can_sync_appointment_reminders(clinic_id)
  and public.can_write_reminder(clinic_id, appointment_id, patient_id)
  and status in ('pending', 'scheduled', 'cancelled', 'skipped')
  and sent_at is null
  and failed_reason is null
  and provider_message_id is null
  and delivered_at is null
  and read_at is null
);

drop policy if exists "clinic members can manage whatsapp settings"
  on public.whatsapp_settings;
create policy "eligible clinic managers can read whatsapp settings"
on public.whatsapp_settings
for select
to authenticated
using (public.can_manage_whatsapp_for_clinic(clinic_id));
create policy "eligible clinic managers can create whatsapp settings"
on public.whatsapp_settings
for insert
to authenticated
with check (public.can_manage_whatsapp_for_clinic(clinic_id));
create policy "eligible clinic managers can update whatsapp settings"
on public.whatsapp_settings
for update
to authenticated
using (public.can_manage_whatsapp_for_clinic(clinic_id))
with check (public.can_manage_whatsapp_for_clinic(clinic_id));

-- Existing clinical policies already call these helpers. Recreating them above
-- adds subscription and clinic-status enforcement without widening roles.
comment on function public.can_access_clinic_data(uuid) is
  'True only for an active member of an active clinic whose subscription currently permits clinical access.';
comment on function public.can_manage_whatsapp_for_clinic(uuid) is
  'Restricts WhatsApp settings to clinic managers on Pro-capable or lifetime subscriptions.';
comment on function public.can_write_appointment(uuid, uuid, uuid) is
  'Prevents appointment patient and treatment references from crossing clinic boundaries.';
comment on function public.can_write_reminder(uuid, uuid, uuid) is
  'Prevents reminder appointment and patient references from crossing clinic boundaries.';
comment on function public.can_sync_appointment_reminders(uuid) is
  'Lets doctors keep reminders aligned with appointment changes without granting sent, failed or provider-delivery transitions.';
