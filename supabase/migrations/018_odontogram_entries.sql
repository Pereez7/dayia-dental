-- Persists the initial adult FDI odontogram without exposing clinical data
-- outside an active clinical membership.

create table if not exists public.odontogram_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  tooth_code text not null,
  surface text,
  status text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint odontogram_entries_tooth_code_valid
    check (tooth_code ~ '^[1-4][1-8]$'),
  constraint odontogram_entries_surface_valid
    check (
      surface is null or surface in (
        'mesial', 'distal', 'occlusal', 'vestibular', 'lingual', 'palatal'
      )
    ),
  constraint odontogram_entries_status_valid
    check (
      status in (
        'healthy', 'caries', 'restored', 'missing', 'pending',
        'observation', 'other'
      )
    ),
  constraint odontogram_entries_scope_unique
    unique nulls not distinct (clinic_id, patient_id, tooth_code, surface)
);

create index if not exists odontogram_entries_patient_idx
  on public.odontogram_entries (clinic_id, patient_id, tooth_code);

create or replace function public.can_access_odontogram(
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
    where memberships.clinic_id = target_clinic_id
      and memberships.user_id = auth.uid()
      and memberships.status = 'active'
      and memberships.role in ('clinic_owner', 'clinic_admin', 'doctor')
  );
$$;

create or replace function public.can_write_odontogram_entry(
  target_clinic_id uuid,
  target_patient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_access_odontogram(target_clinic_id)
    and exists (
      select 1
      from public.patients patients
      where patients.id = target_patient_id
        and patients.clinic_id = target_clinic_id
    );
$$;

create or replace function public.protect_odontogram_entry_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.clinic_id <> old.clinic_id
    or new.patient_id <> old.patient_id
    or new.tooth_code <> old.tooth_code
    or new.surface is distinct from old.surface
    or new.created_by is distinct from old.created_by then
    raise exception 'Odontogram entry scope cannot be changed.';
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_odontogram_entry_scope
  on public.odontogram_entries;

create trigger protect_odontogram_entry_scope
before update on public.odontogram_entries
for each row execute function public.protect_odontogram_entry_scope();

alter table public.odontogram_entries enable row level security;

grant select, insert, update on public.odontogram_entries to authenticated;

revoke all on function public.can_access_odontogram(uuid) from public;
grant execute on function public.can_access_odontogram(uuid) to authenticated;

revoke all on function public.can_write_odontogram_entry(uuid, uuid) from public;
grant execute on function public.can_write_odontogram_entry(uuid, uuid)
  to authenticated;

drop policy if exists "Clinical members can read odontogram entries"
  on public.odontogram_entries;

create policy "Clinical members can read odontogram entries"
  on public.odontogram_entries
  for select
  to authenticated
  using (public.can_access_odontogram(clinic_id));

drop policy if exists "Clinical members can insert odontogram entries"
  on public.odontogram_entries;

create policy "Clinical members can insert odontogram entries"
  on public.odontogram_entries
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and updated_by = auth.uid()
    and public.can_write_odontogram_entry(clinic_id, patient_id)
  );

drop policy if exists "Clinical members can update odontogram entries"
  on public.odontogram_entries;

create policy "Clinical members can update odontogram entries"
  on public.odontogram_entries
  for update
  to authenticated
  using (public.can_access_odontogram(clinic_id))
  with check (public.can_write_odontogram_entry(clinic_id, patient_id));

comment on table public.odontogram_entries is
  'Adult FDI odontogram entries scoped to one clinic and patient.';

comment on column public.odontogram_entries.surface is
  'Null represents the whole tooth in the initial MVP. Advanced surfaces are reserved for a future iteration.';
