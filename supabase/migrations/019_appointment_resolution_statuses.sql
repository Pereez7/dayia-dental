alter table public.appointments
  drop constraint if exists appointments_status_allowed;

alter table public.appointments
  add constraint appointments_status_allowed check (
    status in (
      'pending',
      'confirmed',
      'rescheduled',
      'cancelled',
      'completed',
      'no_show'
    )
  );

comment on constraint appointments_status_allowed on public.appointments is
  'Operational appointment states. completed and no_show are terminal and do not block future availability.';
