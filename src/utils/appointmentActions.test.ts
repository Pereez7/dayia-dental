import { describe, expect, it } from 'vitest'
import {
  canRescheduleAppointment,
  getAppointmentStatusActions,
} from './appointmentActions'

describe('getAppointmentStatusActions', () => {
  it('allows confirming and cancelling pending appointments', () => {
    expect(getAppointmentStatusActions('pending')).toEqual([
      'confirm',
      'reschedule',
      'cancel',
    ])
  })

  it('allows cancelling confirmed appointments without confirming them again', () => {
    expect(getAppointmentStatusActions('confirmed')).toEqual([
      'reschedule',
      'cancel',
    ])
  })

  it('allows cancelling rescheduled appointments', () => {
    expect(getAppointmentStatusActions('rescheduled')).toEqual([
      'reschedule',
      'cancel',
    ])
  })

  it('does not expose actions for cancelled appointments', () => {
    expect(getAppointmentStatusActions('cancelled')).toEqual([])
  })

  it('allows rescheduling pending, confirmed and rescheduled appointments', () => {
    expect(canRescheduleAppointment('pending')).toBe(true)
    expect(canRescheduleAppointment('confirmed')).toBe(true)
    expect(canRescheduleAppointment('rescheduled')).toBe(true)
    expect(canRescheduleAppointment('cancelled')).toBe(false)
  })
})
