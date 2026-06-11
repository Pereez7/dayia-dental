import { describe, expect, it } from 'vitest'
import {
  canRescheduleAppointment,
  getAppointmentStatusActions,
  shouldCloseReschedulePanelAfterStatusChange,
  shouldCloseReschedulePanelOnToggle,
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

  it('closes the reschedule panel when the active appointment is cancelled', () => {
    expect(
      shouldCloseReschedulePanelAfterStatusChange(1, 1, 'cancelled'),
    ).toBe(true)
  })

  it('keeps the reschedule panel when another appointment changes status', () => {
    expect(
      shouldCloseReschedulePanelAfterStatusChange(1, 2, 'cancelled'),
    ).toBe(false)
  })

  it('keeps the reschedule panel when the active appointment is not cancelled', () => {
    expect(
      shouldCloseReschedulePanelAfterStatusChange(1, 1, 'confirmed'),
    ).toBe(false)
  })

  it('closes the reschedule panel when toggling the active appointment', () => {
    expect(shouldCloseReschedulePanelOnToggle(1, 1)).toBe(true)
  })

  it('opens another reschedule panel when toggling a different appointment', () => {
    expect(shouldCloseReschedulePanelOnToggle(1, 2)).toBe(false)
  })
})
