import { describe, expect, it } from 'vitest'

import { resolveReminderDisposition } from './reminderExpiration'

describe('process due reminder expiration', () => {
  it('does not process a reminder whose appointment already passed', () => {
    expect(
      resolveReminderDisposition(
        {
          appointmentDate: '2026-07-15',
          appointmentTime: '10:00',
          status: 'confirmed',
        },
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toBe('expired')
  })

  it('keeps a future appointment processable after scheduled_at is due', () => {
    expect(
      resolveReminderDisposition(
        {
          appointmentDate: '2026-07-18',
          appointmentTime: '10:00',
          status: 'confirmed',
        },
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toBe('processable')
  })

  it('does not expire an appointment later today in Bolivia', () => {
    expect(
      resolveReminderDisposition(
        {
          appointmentDate: '2026-07-17',
          appointmentTime: '10:00',
          status: 'pending',
        },
        new Date('2026-07-17T13:30:00Z'),
      ),
    ).toBe('processable')
  })

  it('cancels reminders when the appointment is cancelled', () => {
    expect(
      resolveReminderDisposition({
        appointmentDate: '2026-07-18',
        appointmentTime: '10:00',
        status: 'cancelled',
      }),
    ).toBe('cancelled')
  })

  it.each(['completed', 'no_show'])(
    'does not process reminders when the appointment is %s',
    (status) => {
      expect(
        resolveReminderDisposition({
          appointmentDate: '2026-07-18',
          appointmentTime: '10:00',
          status,
        }),
      ).toBe('cancelled')
    },
  )
})
