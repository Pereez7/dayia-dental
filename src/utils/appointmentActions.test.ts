import { describe, expect, it } from 'vitest'
import { getAppointmentStatusActions } from './appointmentActions'

describe('getAppointmentStatusActions', () => {
  it('allows confirming and cancelling pending appointments', () => {
    expect(getAppointmentStatusActions('pending')).toEqual(['confirm', 'cancel'])
  })

  it('allows cancelling confirmed appointments without confirming them again', () => {
    expect(getAppointmentStatusActions('confirmed')).toEqual(['cancel'])
  })

  it('allows cancelling rescheduled appointments', () => {
    expect(getAppointmentStatusActions('rescheduled')).toEqual(['cancel'])
  })

  it('does not expose actions for cancelled appointments', () => {
    expect(getAppointmentStatusActions('cancelled')).toEqual([])
  })
})
