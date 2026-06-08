import { describe, expect, it } from 'vitest'
import {
  appointmentTimeSlots,
  createAppointmentTimeSlots,
} from './appointmentTimeSlots'

describe('appointmentTimeSlots', () => {
  it('creates exact appointment times in 15 minute increments', () => {
    expect(createAppointmentTimeSlots('10:00', '10:45', 15)).toEqual([
      { value: '10:00', label: '10:00' },
      { value: '10:15', label: '10:15' },
      { value: '10:30', label: '10:30' },
    ])
  })

  it('keeps the appointment value as the start time', () => {
    expect(appointmentTimeSlots[0]).toEqual({
      value: '00:00',
      label: '00:00',
    })
  })

  it('includes the full day until 23:45', () => {
    expect(appointmentTimeSlots.at(-1)).toEqual({
      value: '23:45',
      label: '23:45',
    })
  })
})
