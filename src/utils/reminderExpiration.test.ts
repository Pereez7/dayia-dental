import { describe, expect, it } from 'vitest'

import type { Reminder } from '../types/Reminder'
import {
  getReminderReconciliation,
  isAppointmentDateTimePast,
} from './reminderExpiration'

const baseReminder: Reminder = {
  appointmentDate: '2026-07-17',
  appointmentId: 'appointment-1',
  appointmentStatus: 'confirmed',
  appointmentTime: '10:00',
  id: 'reminder-1',
  message: 'Recordatorio',
  patientId: 'patient-1',
  patientName: 'Ana Pérez',
  phone: '+59170000000',
  reminderType: '2h',
  scheduledFor: '2026-07-17T12:00:00Z',
  status: 'pending',
  treatment: 'Control',
}

describe('reminder expiration', () => {
  it('marks a pending reminder from a past appointment as skipped', () => {
    expect(
      getReminderReconciliation(
        [{ ...baseReminder, appointmentDate: '2026-07-15' }],
        new Date('2026-07-17T14:00:00Z'),
      ).skippedIds,
    ).toEqual(['reminder-1'])
  })

  it('keeps a future appointment pending', () => {
    expect(
      getReminderReconciliation(
        [{ ...baseReminder, appointmentDate: '2026-07-18' }],
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toEqual({ cancelledIds: [], skippedIds: [] })
  })

  it('keeps an appointment later today pending in clinic time', () => {
    expect(
      getReminderReconciliation(
        [{ ...baseReminder, appointmentTime: '11:00' }],
        new Date('2026-07-17T14:00:00Z'),
      ).skippedIds,
    ).toEqual([])
  })

  it('cancels mutable reminders associated with cancelled appointments', () => {
    expect(
      getReminderReconciliation(
        [{ ...baseReminder, appointmentStatus: 'cancelled' }],
        new Date('2026-07-17T14:00:00Z'),
      ).cancelledIds,
    ).toEqual(['reminder-1'])
  })

  it.each(['completed', 'no_show'] as const)(
    'cancels mutable reminders for a %s appointment',
    (appointmentStatus) => {
      expect(
        getReminderReconciliation([
          { ...baseReminder, appointmentStatus },
        ]).cancelledIds,
      ).toEqual([baseReminder.id])
    },
  )

  it('does not change terminal reminder statuses', () => {
    expect(
      getReminderReconciliation(
        [{ ...baseReminder, appointmentDate: '2026-07-15', status: 'sent' }],
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toEqual({ cancelledIds: [], skippedIds: [] })
  })

  it('compares Bolivia wall-clock time instead of treating it as UTC', () => {
    expect(
      isAppointmentDateTimePast(
        '2026-07-17',
        '10:00',
        new Date('2026-07-17T13:30:00Z'),
      ),
    ).toBe(false)
  })
})
