-- Architecture support for WhatsApp API real delivery.
-- Do not store WhatsApp access tokens in frontend-readable tables.
-- Access tokens must live in Supabase Secrets or another protected backend store.

create unique index if not exists whatsapp_settings_clinic_id_unique_idx
  on public.whatsapp_settings (clinic_id);

create index if not exists whatsapp_settings_clinic_id_idx
  on public.whatsapp_settings (clinic_id);

alter table public.reminders
  add column if not exists provider_message_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists reminders_clinic_id_provider_message_id_idx
  on public.reminders (clinic_id, provider_message_id)
  where provider_message_id is not null;

comment on table public.whatsapp_settings is
  'Clinic-scoped non-secret WhatsApp Business configuration. Access tokens must stay in Supabase Secrets/backend only.';

comment on column public.whatsapp_settings.phone_number_id is
  'WhatsApp Cloud API phone number id for the clinic. Not a secret.';

comment on column public.whatsapp_settings.business_account_id is
  'WhatsApp Business Account id for the clinic. Not a secret.';

comment on column public.reminders.provider_message_id is
  'Future WhatsApp provider message id returned by Cloud API.';

comment on column public.reminders.metadata is
  'Non-secret provider metadata for delivery diagnostics and webhook events.';
