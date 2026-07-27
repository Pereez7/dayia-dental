begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

create or replace function public.test_attempt_reminder_sent_transition(
  target_reminder_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.reminders
  set status = 'sent', sent_at = now()
  where id = target_reminder_id;

  return 'updated';
exception
  when insufficient_privilege then
    return sqlstate;
end;
$$;

revoke all on function public.test_attempt_reminder_sent_transition(uuid)
  from public;
grant execute on function public.test_attempt_reminder_sent_transition(uuid)
  to authenticated;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'doctor-a@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'reception-a@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'owner-b@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'blocked-owner@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'platform-admin@rls.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.clinics (id, name, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'RLS Clinic A', 'active'),
  ('a0000000-0000-0000-0000-000000000002', 'RLS Clinic B', 'active'),
  ('a0000000-0000-0000-0000-000000000003', 'RLS Blocked Clinic', 'active');

insert into public.profiles (
  id,
  full_name,
  role,
  email,
  is_platform_admin
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Owner A',
    'clinic_admin',
    'owner-a@rls.test',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Doctor A',
    'doctor',
    'doctor-a@rls.test',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Reception A',
    'receptionist',
    'reception-a@rls.test',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Owner B',
    'clinic_admin',
    'owner-b@rls.test',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Blocked Owner',
    'clinic_admin',
    'blocked-owner@rls.test',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Platform Admin',
    'super_admin',
    'platform-admin@rls.test',
    true
  );

insert into public.clinic_memberships (
  clinic_id,
  user_id,
  role,
  status,
  activated_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'clinic_owner',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'doctor',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'receptionist',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    'clinic_owner',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    'clinic_owner',
    'active',
    now()
  );

insert into public.clinic_subscriptions (
  clinic_id,
  plan_id,
  status,
  current_period_starts_at,
  current_period_ends_at,
  grace_ends_at,
  payment_status,
  billing_cycle
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'pro',
    'active',
    now(),
    now() + interval '30 days',
    now() + interval '35 days',
    'paid',
    'monthly'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'pro',
    'active',
    now(),
    now() + interval '30 days',
    now() + interval '35 days',
    'paid',
    'monthly'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'pro',
    'blocked',
    now() - interval '30 days',
    now() - interval '1 day',
    now() - interval '1 day',
    'past_due',
    'monthly'
  );

insert into public.patients (
  id,
  clinic_id,
  first_name,
  last_name,
  phone
)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Patient',
    'A',
    '70000001'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'Patient',
    'B',
    '70000002'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'Patient',
    'Blocked',
    '70000003'
  );

insert into public.treatments (
  id,
  clinic_id,
  name,
  duration_minutes
)
values
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Treatment A',
    30
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'Treatment B',
    30
  );

insert into public.appointments (
  id,
  clinic_id,
  patient_id,
  treatment_id,
  appointment_date,
  start_time,
  duration_minutes,
  status
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  current_date + 1,
  '09:00',
  30,
  'pending'
);

insert into public.reminders (
  id,
  clinic_id,
  appointment_id,
  patient_id,
  channel,
  scheduled_at,
  status,
  message
)
values (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'whatsapp',
  now() + interval '1 day',
  'scheduled',
  'Appointment reminder'
);

insert into public.clinical_records (
  clinic_id,
  patient_id,
  created_by,
  reason,
  diagnosis,
  treatment
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Control',
  'Healthy',
  'Observation'
);

insert into public.odontogram_entries (
  clinic_id,
  patient_id,
  tooth_code,
  surface,
  status,
  created_by,
  updated_by
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '11',
  null,
  'healthy',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.whatsapp_settings (
  clinic_id,
  provider,
  phone_number,
  is_connected
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'meta',
  '+59170000001',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.patients),
  1::bigint,
  'owner sees patients only from their active clinic'
);
select ok(
  public.can_manage_clinic_settings(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'owner can manage clinic settings'
);
select ok(
  public.can_manage_team_for_clinic(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'owner on Pro can manage the clinic team'
);
select ok(
  public.can_manage_whatsapp_for_clinic(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'owner on Pro can manage WhatsApp settings'
);
select ok(
  public.can_manage_reminder_queue(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'owner can manage manual reminder outcomes'
);
select is(
  (select count(*) from public.profiles),
  3::bigint,
  'team manager sees only profiles belonging to the managed clinic'
);
select is(
  (select count(*) from public.whatsapp_settings),
  1::bigint,
  'eligible owner can read WhatsApp settings'
);
select ok(
  public.can_write_appointment(
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001'
  ),
  'same-clinic appointment relationships are accepted'
);
select ok(not (
  public.can_write_appointment(
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    null
  )),
  'cross-clinic appointment relationships are rejected'
);
select ok(not (
  public.can_write_reminder(
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  )),
  'cross-clinic reminder relationships are rejected'
);
insert into public.patients (
  clinic_id,
  first_name,
  last_name,
  phone
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Created',
  'By Owner',
  '70000004'
);

update public.profiles
set full_name = 'Owner A Updated'
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select full_name
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'Owner A Updated',
  'user can update their safe own profile field'
);

update public.treatments
set name = 'Treatment A Updated'
where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (
    select name
    from public.treatments
    where id = 'c0000000-0000-0000-0000-000000000001'
  ),
  'Treatment A Updated',
  'owner can update clinic treatments'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"doctor-a@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select is(
  (select count(*) from public.patients),
  2::bigint,
  'doctor can read clinic patients, including the newly created patient'
);
select is(
  (select count(*) from public.clinical_records),
  1::bigint,
  'doctor can read clinical history'
);
select is(
  (select count(*) from public.odontogram_entries),
  1::bigint,
  'doctor can read odontogram entries'
);
select ok(not (
  public.can_manage_clinic_settings(
    'a0000000-0000-0000-0000-000000000001'
  )),
  'doctor cannot manage clinic settings'
);
select ok(
  public.can_sync_appointment_reminders(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'doctor can synchronize reminders as part of appointment changes'
);
select ok(not (
  public.can_manage_reminder_queue(
    'a0000000-0000-0000-0000-000000000001'
  )),
  'doctor cannot manage manual reminder outcomes'
);
select is(
  public.test_attempt_reminder_sent_transition(
    'e0000000-0000-0000-0000-000000000001'
  ),
  '42501',
  'doctor cannot mark reminders as sent'
);
update public.treatments
set name = 'Doctor Must Not Change This'
where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (
    select name
    from public.treatments
    where id = 'c0000000-0000-0000-0000-000000000001'
  ),
  'Treatment A Updated',
  'doctor cannot update clinic treatments'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"reception-a@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  true
);

select is(
  (select count(*) from public.patients),
  2::bigint,
  'reception can read non-clinical patient data'
);
select is(
  (select count(*) from public.clinical_records),
  0::bigint,
  'reception cannot read clinical history'
);
select is(
  (select count(*) from public.odontogram_entries),
  0::bigint,
  'reception cannot read odontogram entries'
);
select ok(
  public.can_manage_reminder_queue(
    'a0000000-0000-0000-0000-000000000001'
  ),
  'reception can manage manual reminder outcomes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","email":"owner-b@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000004',
  true
);

select is(
  (select count(*) from public.patients),
  1::bigint,
  'a second clinic owner cannot see Clinic A patients'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a second clinic owner cannot see Clinic A profiles'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated","email":"blocked-owner@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000005',
  true
);

select is(
  (select count(*) from public.clinics),
  1::bigint,
  'blocked member can still read clinic context for the access screen'
);
select is(
  (select count(*) from public.clinic_subscriptions),
  1::bigint,
  'blocked member can still read subscription context'
);
select is(
  (select count(*) from public.patients),
  0::bigint,
  'blocked subscription cannot read operational patient data'
);
select ok(not (
  public.can_access_clinic_data(
    'a0000000-0000-0000-0000-000000000003'
  )),
  'blocked subscription fails the shared clinical-access boundary'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated","email":"platform-admin@rls.test"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000006',
  true
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'platform admin can read only their own profile through the client'
);
select is(
  (select count(*) from public.patients),
  0::bigint,
  'platform admin flag does not grant direct clinical access'
);

select ok(not (
  has_column_privilege(
    'authenticated',
    'public.profiles',
    'is_platform_admin',
    'UPDATE'
  )),
  'client cannot elevate platform administrator status'
);
select ok(
  has_column_privilege(
    'authenticated',
    'public.profiles',
    'full_name',
    'UPDATE'
  ),
  'client retains safe profile-name updates'
);
select ok(not (
  has_column_privilege(
    'authenticated',
    'public.whatsapp_settings',
    'is_connected',
    'UPDATE'
  )),
  'client cannot mark WhatsApp as verified'
);
select ok(not (
  has_column_privilege(
    'authenticated',
    'public.clinical_records',
    'clinic_id',
    'UPDATE'
  )),
  'client cannot move clinical records between clinics'
);
select ok(not (
  has_column_privilege(
    'authenticated',
    'public.odontogram_entries',
    'patient_id',
    'UPDATE'
  )),
  'client cannot move odontogram entries between patients'
);
select ok(not (
  has_table_privilege(
    'authenticated',
    'public.patients',
    'DELETE'
  )),
  'client cannot delete patient records'
);

select * from finish();
rollback;
