import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../migrations/035_atomic_appointment_scheduling.sql',
    import.meta.url,
  ),
  'utf8',
).replaceAll('\r\n', '\n')
const service = readFileSync(
  new URL('../../src/services/appointmentsService.ts', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')

describe('atomic appointment scheduling contract', () => {
  it('serializes writes per clinic and date before checking conflicts', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('appointments_active_patient_day_idx')
    expect(migration).toContain('appointments_active_clinic_day_time_idx')
    expect(migration).toContain('APPOINTMENT_SLOT_CONFLICT')
    expect(migration).toContain('APPOINTMENT_PATIENT_DAY_CONFLICT')
    expect(migration).toMatch(
      /appointments\.start_time[\s\S]{0,220}< target_start_time \+ make_interval/,
    )
  })

  it('creates and reschedules together with their audit entry', () => {
    expect(migration).toContain(
      'create or replace function public.create_clinic_appointment',
    )
    expect(migration).toContain(
      'create or replace function public.reschedule_clinic_appointment',
    )
    expect(migration.match(/insert into public\.appointment_change_logs/g)).toHaveLength(
      2,
    )
    expect(migration).toContain('APPOINTMENT_STALE')
  })

  it('removes direct scheduling writes from authenticated clients', () => {
    expect(migration).toMatch(
      /revoke insert \([\s\S]+?\) on table public\.appointments from authenticated/,
    )
    expect(migration).toMatch(
      /revoke update \([\s\S]+?appointment_date[\s\S]+?start_time[\s\S]+?\) on table public\.appointments from authenticated/,
    )
  })

  it('routes real create and reschedule operations through the RPCs', () => {
    const createStart = service.indexOf('export async function createAppointment')
    const statusStart = service.indexOf(
      'export async function updateAppointmentStatus',
      createStart,
    )
    const rescheduleStart = service.indexOf(
      'export async function rescheduleAppointment',
    )
    const logStart = service.indexOf(
      'export async function createAppointmentChangeLog',
      rescheduleStart,
    )
    const createService = service.slice(createStart, statusStart)
    const rescheduleService = service.slice(rescheduleStart, logStart)

    expect(createService).toContain(".rpc('create_clinic_appointment'")
    expect(createService).not.toContain(".from('appointments')")
    expect(rescheduleService).toContain("'reschedule_clinic_appointment'")
    expect(rescheduleService).not.toContain(".from('appointments')")
  })
})
