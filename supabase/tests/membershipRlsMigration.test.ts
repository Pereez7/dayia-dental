import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../migrations/027_membership_rls_hardening.sql',
    import.meta.url,
  ),
  'utf8',
)

describe('membership RLS hardening migration', () => {
  it('removes every legacy clinic-wide FOR ALL policy', () => {
    expect(migration).toContain(
      'drop policy if exists "clinic members can manage patients"',
    )
    expect(migration).toContain(
      'drop policy if exists "clinic members can manage appointments"',
    )
    expect(migration).toContain(
      'drop policy if exists "clinic members can manage reminders"',
    )
    expect(migration).not.toMatch(
      /create policy[\s\S]{0,160}\nfor all\s*\nto authenticated/i,
    )
  })

  it('uses memberships, clinic state and subscription access as one boundary', () => {
    expect(migration).toContain(
      "memberships.status = 'active'",
    )
    expect(migration).toContain(
      "coalesce(clinics.status, 'active') = 'active'",
    )
    expect(migration).toContain(
      'public.subscription_allows_clinical_access(target_clinic_id)',
    )
  })

  it('keeps clinical history and odontogram away from reception', () => {
    expect(migration).toContain(
      "memberships.role in ('clinic_owner', 'clinic_admin', 'doctor')",
    )
    expect(migration).toContain(
      'select public.can_access_clinical_records(target_clinic_id);',
    )
  })

  it('checks cross-clinic appointment and reminder relationships', () => {
    expect(migration).toContain(
      'public.can_write_appointment(clinic_id, patient_id, treatment_id)',
    )
    expect(migration).toContain(
      'public.can_write_reminder(clinic_id, appointment_id, patient_id)',
    )
    expect(migration).toContain(
      'appointments.patient_id = target_patient_id',
    )
  })

  it('limits doctor reminder writes to appointment synchronization', () => {
    expect(migration).toContain(
      'create policy "reminder managers can update reminders"',
    )
    expect(migration).toContain(
      'create policy "doctors can sync appointment reminders"',
    )
    expect(migration).toContain(
      "and status in ('pending', 'scheduled', 'cancelled', 'skipped')",
    )
    expect(migration).toContain(
      'and provider_message_id is null',
    )
    expect(migration).toMatch(
      /create policy "reminder managers can update reminders"[\s\S]*?with check \(\s*public\.can_manage_reminder_queue\(clinic_id\)\s*and\s*public\.can_write_reminder/,
    )
  })

  it('limits authenticated profile writes to safe identity fields', () => {
    expect(migration).toContain(
      'grant update (full_name, email)',
    )
    expect(migration).toContain(
      "raise exception 'PROFILE_PROTECTED_FIELDS'",
    )
    expect(migration).toContain(
      "raise exception 'PROFILE_EMAIL_CHANGE_FORBIDDEN'",
    )
  })

  it('does not let React mark WhatsApp as connected', () => {
    expect(migration).toContain(
      'grant insert (\n  clinic_id, provider, phone_number, phone_number_id, business_account_id',
    )
    expect(migration).not.toContain(
      'provider, phone_number, phone_number_id, business_account_id, is_connected',
    )
  })

  it('keeps provider delivery fields writable only from trusted backend code', () => {
    expect(migration).toContain(
      'grant update (\n  scheduled_at, status, message, sent_at, failed_reason, metadata',
    )
    expect(migration).not.toContain(
      'failed_reason, provider_message_id',
    )
  })

  it('allows WhatsApp settings only for Pro-capable or lifetime clinics', () => {
    expect(migration).toContain(
      'plans.can_use_whatsapp_automation = true',
    )
    expect(migration).toContain(
      'or subscriptions.is_lifetime = true',
    )
    expect(migration).toContain(
      'public.can_manage_whatsapp_for_clinic(clinic_id)',
    )
  })

  it('keeps destructive access off clinical and operational records', () => {
    const deletePolicies = migration
      .split('create policy "')
      .slice(1)
      .map((policy) => policy.split(';', 1)[0])
      .filter((policy) => /\nfor delete\s*\n/i.test(policy))
      .map((policy) => policy.slice(0, policy.indexOf('"')))

    expect(deletePolicies).toEqual([
      'clinic managers can delete calendar exceptions',
    ])
    expect(migration).toContain(
      'revoke all privileges on table public.clinical_records',
    )
    expect(migration).toContain(
      'revoke all privileges on table public.odontogram_entries',
    )
  })

  it('protects clinical scope, authorship and audit columns at privilege level', () => {
    expect(migration).toContain(
      'grant update (\n  record_date, reason, diagnosis, treatment, observations',
    )
    expect(migration).toContain(
      'grant update (status, notes)',
    )
    expect(migration).not.toContain(
      'grant update (clinic_id, patient_id',
    )
  })
})
