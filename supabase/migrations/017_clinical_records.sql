-- Persistent clinical history scoped by active clinic memberships.
-- Odontogram persistence is intentionally out of scope for this migration.

create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  record_date timestamptz not null default now(),
  reason text not null,
  diagnosis text not null,
  treatment text not null,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_records_reason_required check (length(btrim(reason)) > 0),
  constraint clinical_records_diagnosis_required check (length(btrim(diagnosis)) > 0),
  constraint clinical_records_treatment_required check (length(btrim(treatment)) > 0)
);

create index if not exists clinical_records_clinic_date_idx
  on public.clinical_records (clinic_id, record_date desc);

create index if not exists clinical_records_patient_date_idx
  on public.clinical_records (patient_id, record_date desc);

create or replace function public.can_access_clinical_records(
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_memberships memberships
    where memberships.user_id = auth.uid()
      and memberships.clinic_id = target_clinic_id
      and memberships.status = 'active'
      and memberships.role in ('clinic_owner', 'clinic_admin', 'doctor')
  )
$$;

create or replace function public.can_write_clinical_record(
  target_patient_id uuid,
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_clinical_records(target_clinic_id)
    and exists (
      select 1
      from public.patients patient
      where patient.id = target_patient_id
        and patient.clinic_id = target_clinic_id
    )
$$;

create or replace function public.protect_clinical_record_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_id <> old.clinic_id
    or new.patient_id <> old.patient_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Clinical record scope cannot be changed.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_clinical_record_scope
  on public.clinical_records;

create trigger protect_clinical_record_scope
before update on public.clinical_records
for each row execute function public.protect_clinical_record_scope();

alter table public.clinical_records enable row level security;

grant select, insert, update on public.clinical_records to authenticated;

revoke all on function public.can_access_clinical_records(uuid) from public;
grant execute on function public.can_access_clinical_records(uuid)
  to authenticated;

revoke all on function public.can_write_clinical_record(uuid, uuid)
  from public;
grant execute on function public.can_write_clinical_record(uuid, uuid)
  to authenticated;

revoke all on function public.protect_clinical_record_scope() from public;

drop policy if exists "clinical roles can read clinical records"
  on public.clinical_records;
create policy "clinical roles can read clinical records"
  on public.clinical_records
  for select
  to authenticated
  using (public.can_access_clinical_records(clinic_id));

drop policy if exists "clinical roles can create clinical records"
  on public.clinical_records;
create policy "clinical roles can create clinical records"
  on public.clinical_records
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.can_write_clinical_record(patient_id, clinic_id)
  );

drop policy if exists "clinical roles can update clinical records"
  on public.clinical_records;
create policy "clinical roles can update clinical records"
  on public.clinical_records
  for update
  to authenticated
  using (public.can_access_clinical_records(clinic_id))
  with check (
    public.can_write_clinical_record(patient_id, clinic_id)
  );

comment on table public.clinical_records is
  'Persistent patient clinical history. Access is restricted to active clinic owners, clinic admins and doctors.';

comment on column public.clinical_records.created_by is
  'Authenticated profile that created the record. The value is immutable after insert.';
