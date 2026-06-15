-- DayIA Dental MVP backend schema.
-- This migration prepares a multi-clinic Supabase/PostgreSQL model.
-- Do not store frontend secrets or WhatsApp access tokens in client code.

create extension if not exists "pgcrypto";

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  country_code text default '+591',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  full_name text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  country_code text default '+591',
  email text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatments_duration_minutes_positive check (duration_minutes > 0)
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  weekday integer not null,
  is_open boolean not null default true,
  start_time time,
  end_time time,
  slot_interval_minutes integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_hours_weekday_range check (weekday between 0 and 6),
  constraint business_hours_slot_interval_positive check (slot_interval_minutes > 0),
  constraint business_hours_time_order check (
    is_open = false
    or start_time is null
    or end_time is null
    or start_time < end_time
  )
);

create table if not exists public.calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  date date not null,
  type text not null,
  start_time time,
  end_time time,
  reason text,
  reason_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_exceptions_type_allowed check (type in ('closed', 'special-hours')),
  constraint calendar_exceptions_special_hours_time_order check (
    type = 'closed'
    or (start_time is not null and end_time is not null and start_time < end_time)
  )
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  treatment_id uuid references public.treatments(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  duration_minutes integer not null default 30,
  status text not null,
  reason text,
  cancel_reason text,
  reschedule_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_duration_minutes_positive check (duration_minutes > 0),
  constraint appointments_status_allowed check (
    status in ('pending', 'confirmed', 'rescheduled', 'cancelled')
  )
);

create table if not exists public.appointment_change_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  type text not null,
  description text,
  from_date date,
  from_time time,
  to_date date,
  to_time time,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  channel text not null default 'whatsapp',
  scheduled_at timestamptz not null,
  status text not null,
  message text not null,
  sent_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_channel_allowed check (channel in ('whatsapp')),
  constraint reminders_status_allowed check (
    status in ('pending', 'scheduled', 'sent', 'failed', 'cancelled', 'skipped')
  )
);

create table if not exists public.whatsapp_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  provider text,
  phone_number text,
  phone_number_id text,
  business_account_id text,
  is_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- Future secret fields, such as WhatsApp access tokens, must live only in
  -- backend/Edge Function protected storage, never in frontend code.
);

create unique index if not exists profiles_clinic_id_id_idx
  on public.profiles (clinic_id, id);
create index if not exists patients_clinic_id_idx
  on public.patients (clinic_id);
create index if not exists appointments_clinic_id_appointment_date_idx
  on public.appointments (clinic_id, appointment_date);
create index if not exists appointments_clinic_id_patient_id_idx
  on public.appointments (clinic_id, patient_id);
create index if not exists reminders_clinic_id_scheduled_at_idx
  on public.reminders (clinic_id, scheduled_at);
create index if not exists calendar_exceptions_clinic_id_date_idx
  on public.calendar_exceptions (clinic_id, date);
create unique index if not exists calendar_exceptions_clinic_id_date_unique_idx
  on public.calendar_exceptions (clinic_id, date);
create index if not exists treatments_clinic_id_is_active_idx
  on public.treatments (clinic_id, is_active);
create unique index if not exists whatsapp_settings_clinic_id_unique_idx
  on public.whatsapp_settings (clinic_id);

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.treatments enable row level security;
alter table public.business_hours enable row level security;
alter table public.calendar_exceptions enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_change_logs enable row level security;
alter table public.reminders enable row level security;
alter table public.whatsapp_settings enable row level security;

-- RLS policy direction for the next Auth step:
-- 1. A user belongs to one clinic through public.profiles.clinic_id.
-- 2. Reads/writes must be scoped to rows whose clinic_id matches that profile.
-- 3. Avoid public policies for clinical data.
-- 4. Service role access should be reserved for trusted backend/Edge Functions.
--
-- Example policy shape for a later migration:
-- create policy "clinic members can read patients"
-- on public.patients
-- for select
-- using (
--   clinic_id = (
--     select profiles.clinic_id
--     from public.profiles
--     where profiles.id = auth.uid()
--   )
-- );
