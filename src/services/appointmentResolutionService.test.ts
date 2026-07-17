import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const appointmentSingle = vi.fn()
  const appointmentSelect = vi.fn(() => ({ single: appointmentSingle }))
  const appointmentIdEq = vi.fn(() => ({ select: appointmentSelect }))
  const appointmentClinicEq = vi.fn(() => ({ eq: appointmentIdEq }))
  const appointmentUpdate = vi.fn((values: { status: string }) => {
    void values
    return { eq: appointmentClinicEq }
  })
  const logSingle = vi.fn()
  const logSelect = vi.fn(() => ({ single: logSingle }))
  const logInsert = vi.fn((values: Array<{ type: string }>) => {
    void values
    return { select: logSelect }
  })
  const from = vi.fn((table: string) =>
    table === 'appointments'
      ? { update: appointmentUpdate }
      : { insert: logInsert },
  )

  return {
    appointmentSingle,
    appointmentUpdate,
    from,
    logInsert,
    logSingle,
  }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from },
}))

import type { Appointment } from '../types/Appointment'
import { updateAppointmentStatus } from './appointmentsService'

const appointment: Appointment = {
  date: '2026-07-15',
  id: 'appointment-1',
  patient: 'Ana Pérez',
  patientId: 'patient-1',
  status: 'pending',
  time: '10:00',
  treatment: 'Control',
}

describe('appointment resolution persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.logSingle.mockImplementation(() => ({
      data: {
        appointment_id: 'appointment-1',
        clinic_id: 'clinic-1',
        created_at: '2026-07-17T14:00:00Z',
        description: 'Cambio de estado.',
        from_date: null,
        from_time: null,
        id: 'log-1',
        to_date: null,
        to_time: null,
        type: queryMocks.logInsert.mock.calls.at(-1)?.[0]?.[0]?.type,
      },
      error: null,
    }))
    queryMocks.appointmentSingle.mockImplementation(() => ({
      data: {
        appointment_date: appointment.date,
        cancel_reason: null,
        clinic_id: 'clinic-1',
        created_at: '2026-07-15T12:00:00Z',
        duration_minutes: 30,
        id: appointment.id,
        patient_id: appointment.patientId,
        reason: appointment.treatment,
        reschedule_reason: null,
        start_time: appointment.time,
        status: queryMocks.appointmentUpdate.mock.calls.at(-1)?.[0]?.status,
        treatment_id: null,
        updated_at: '2026-07-17T14:00:00Z',
      },
      error: null,
    }))
  })

  it.each([
    ['completed', 'completed'],
    ['no_show', 'no_show'],
  ] as const)('persists %s and its activity log', async (status, logType) => {
    const result = await updateAppointmentStatus(
      'clinic-1',
      appointment.id,
      status,
      undefined,
      appointment,
    )

    expect(queryMocks.appointmentUpdate).toHaveBeenCalledWith({ status })
    expect(queryMocks.logInsert).toHaveBeenCalledWith([
      expect.objectContaining({ type: logType }),
    ])
    expect(result.data?.status).toBe(status)
    expect(result.data?.changeLog?.at(-1)?.type).toBe(logType)
  })

  it('returns a controlled message when the database status constraint is outdated', async () => {
    queryMocks.appointmentSingle.mockReturnValueOnce({
      data: null,
      error: { code: '23514' },
    })

    const result = await updateAppointmentStatus(
      'clinic-1',
      appointment.id,
      'completed',
      undefined,
      appointment,
    )

    expect(result.data).toBeNull()
    expect(result.error).toContain('migración pendiente')
    expect(result.error).not.toContain('23514')
  })
})
