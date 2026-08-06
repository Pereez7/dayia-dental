import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const app = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const migration = readFileSync(
  new URL('../migrations/038_bounded_clinic_reminders.sql', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const service = readFileSync(
  new URL('../../src/services/remindersService.ts', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')

describe('bounded reminders contract', () => {
  it('reconciles mutable reminders atomically in the clinic timezone', () => {
    expect(migration).toContain(
      'create or replace function public.reconcile_clinic_reminders',
    )
    expect(migration).toContain("reminders.status in ('pending', 'scheduled')")
    expect(migration).toContain("at time zone 'America/La_Paz'")
    expect(migration).toContain("'appointment_date', appointments.appointment_date::text")
  })

  it('bounds the queue and pages complete appointment occurrences', () => {
    expect(migration).toContain(
      'create or replace function public.get_clinic_reminder_queue_page',
    )
    expect(migration).toContain('window_start := target_reference_date - 7')
    expect(migration).toContain('window_end := target_reference_date + 30')
    expect(migration).toContain('limit target_page_size + 1')
    expect(migration).toContain("'nextCursor'")
    expect(migration).toContain('group by\n      matching_rows.appointment_id')
  })

  it('executes queue search and filters in PostgreSQL', () => {
    expect(migration).toContain("target_status = 'all'")
    expect(migration).toContain("target_appointment_status = 'past_unresolved'")
    expect(migration).toContain('public.normalize_patient_search')
    expect(migration).toContain("'selectedDateSummary'")
  })

  it('routes the real reminder view through the bounded RPC only', () => {
    expect(app).toContain('getReminderQueuePage')
    expect(app).toContain('reconcileClinicReminders')
    expect(app).not.toContain('getReconciledRemindersByClinic')
    expect(app).not.toContain('upsertRemindersForAppointment')
    expect(app).not.toContain('cancelRemindersForAppointment')
    expect(app).toContain('handleLoadMoreReminders')

    const needsAppointmentsStart = app.indexOf('function sectionNeedsAppointments')
    const needsPatientsStart = app.indexOf('function sectionNeedsPatients')
    const needsAppointments = app.slice(needsAppointmentsStart, needsPatientsStart)
    const needsPatients = app.slice(needsPatientsStart)

    expect(needsAppointments).not.toContain("'whatsapp-reminders'")
    expect(needsPatients).not.toContain("'whatsapp-reminders'")
    expect(service).toContain("'get_clinic_reminder_queue_page'")
  })

  it('keeps authorization and audit snapshots in the database contract', () => {
    expect(migration).toContain('public.can_manage_reminder_queue')
    expect(migration).toContain('security definer')
    expect(migration).toContain('from public, anon')
    expect(migration).toContain("'appointment_status', appointments.status")
    expect(migration).toContain("'note', 'La cita ya pasó sin envío del recordatorio.'")
  })
})
