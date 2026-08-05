import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../migrations/034_bounded_clinic_agenda.sql', import.meta.url),
  'utf8',
)
const service = readFileSync(
  new URL('../../src/services/appointmentsService.ts', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

describe('bounded clinic agenda contract', () => {
  it('authorizes every snapshot and caps the visible page', () => {
    expect(migration).toContain(
      'not public.can_access_clinic_data(target_clinic_id)',
    )
    expect(migration).toContain('target_page_size > 50')
    expect(migration).toContain('limit target_page_size + 1')
    expect(migration).toContain('to authenticated')
    expect(migration).not.toMatch(
      /grant execute on function public\.get_clinic_agenda_snapshot[\s\S]{0,220}to anon/i,
    )
  })

  it('uses stable ordered indexes and a two-column cursor', () => {
    expect(migration).toContain('appointments_clinic_day_schedule_idx')
    expect(migration).toContain(
      'appointment_change_logs_appointment_recent_idx',
    )
    expect(migration).toContain(
      '(appointments.start_time, appointments.id)',
    )
    expect(migration).toContain(
      '> (target_after_start_time, target_after_id)',
    )
  })

  it('routes the real agenda through the snapshot before the legacy full loader', () => {
    const boundedBranch = app.indexOf(
      "effectiveActiveSection === 'appointments-agenda'",
    )
    const legacyLoader = app.indexOf('getAppointmentsByClinic(', boundedBranch)

    expect(service).toContain("'get_clinic_agenda_snapshot'")
    expect(boundedBranch).toBeGreaterThan(-1)
    expect(app.indexOf('getAppointmentAgendaSnapshot(', boundedBranch)).toBeLessThan(
      legacyLoader,
    )
    const patientScopeStart = app.indexOf('function sectionNeedsPatients')
    const patientScopeEnd = app.indexOf(
      'function getNextNumericPatientId',
      patientScopeStart,
    )

    expect(app.slice(patientScopeStart, patientScopeEnd)).not.toContain(
      "section === 'appointments-agenda'",
    )
  })

  it('keeps availability date-scoped with explicit columns', () => {
    const availabilityStart = service.indexOf(
      'export async function getAppointmentAvailabilityByDate',
    )
    const nextFunction = service.indexOf(
      'export async function getAppointmentsByDate',
      availabilityStart,
    )
    const availabilityService = service.slice(availabilityStart, nextFunction)

    expect(availabilityService).toContain(".eq('appointment_date', date)")
    expect(availabilityService).toContain(
      "'id, patient_id, appointment_date, start_time, duration_minutes, status, reason'",
    )
    expect(availabilityService).not.toContain(".select('*')")
  })
})
