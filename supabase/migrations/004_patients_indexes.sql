-- Useful lookup index for patient lists and future search/order by last name.

create index if not exists patients_clinic_id_last_name_idx
  on public.patients (clinic_id, last_name);
