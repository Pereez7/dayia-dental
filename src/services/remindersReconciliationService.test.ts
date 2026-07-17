import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const statusIn = vi.fn()
  const idsIn = vi.fn(() => ({ in: statusIn }))
  const clinicEq = vi.fn(() => ({ in: idsIn }))
  const update = vi.fn(() => ({ eq: clinicEq }))
  const from = vi.fn(() => ({ update }))

  return { clinicEq, from, idsIn, statusIn, update }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from },
}))

import type { Reminder } from '../types/Reminder'
import { reconcileExpiredRemindersByClinic } from './remindersService'

const baseReminder: Reminder = {
  appointmentDate: '2026-07-15',
  appointmentId: 'appointment-1',
  appointmentStatus: 'confirmed',
  appointmentTime: '10:00',
  id: 'expired-reminder',
  message: 'Recordatorio',
  patientId: 'patient-1',
  patientName: 'Ana Pérez',
  phone: '+59170000000',
  reminderType: '2h',
  scheduledFor: '2026-07-15T12:00:00Z',
  status: 'pending',
  treatment: 'Control',
}

describe('reminder reconciliation service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.statusIn.mockResolvedValue({ error: null })
  })

  it('persists expired and cancelled reminders without touching future ones', async () => {
    const result = await reconcileExpiredRemindersByClinic(
      'clinic-1',
      [
        baseReminder,
        {
          ...baseReminder,
          appointmentDate: '2026-07-18',
          id: 'future-reminder',
        },
        {
          ...baseReminder,
          appointmentDate: '2026-07-18',
          appointmentStatus: 'cancelled',
          id: 'cancelled-reminder',
        },
      ],
      new Date('2026-07-17T14:00:00Z'),
    )

    expect(result).toEqual({
      data: { cancelledCount: 1, changed: true, skippedCount: 1 },
      error: null,
    })
    expect(queryMocks.update).toHaveBeenCalledWith({
      metadata: { reason: 'appointment_cancelled' },
      status: 'cancelled',
    })
    expect(queryMocks.update).toHaveBeenCalledWith({
      metadata: {
        appointment_date: '2026-07-15',
        appointment_status: 'confirmed',
        appointment_time: '10:00',
        note: 'La cita ya pasó sin envío del recordatorio.',
        reason: 'appointment_passed',
      },
      status: 'skipped',
    })
    expect(queryMocks.idsIn).toHaveBeenCalledWith('id', [
      'cancelled-reminder',
    ])
    expect(queryMocks.idsIn).toHaveBeenCalledWith('id', [
      'expired-reminder',
    ])
    expect(queryMocks.idsIn).not.toHaveBeenCalledWith('id', [
      'future-reminder',
    ])
  })
})
