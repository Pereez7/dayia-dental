import { describe, expect, it } from 'vitest'
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from './appointmentFormatters'

describe('appointmentFormatters', () => {
  it('formats an appointment date', () => {
    expect(formatAppointmentDate('2026-06-05')).toBe('05-jun')
  })

  it('formats an appointment time', () => {
    expect(formatAppointmentTime('09:00')).toBe('09:00')
  })

  it('returns the visible label for an appointment status', () => {
    expect(getAppointmentStatusLabel('confirmed')).toBe('Confirmada')
    expect(getAppointmentStatusLabel('pending')).toBe('Pendiente')
    expect(getAppointmentStatusLabel('cancelled')).toBe('Cancelada')
    expect(getAppointmentStatusLabel('completed')).toBe('Atendida')
    expect(getAppointmentStatusLabel('no_show')).toBe('No asistió')
    expect(getAppointmentStatusLabel('rescheduled')).toBe('Reprogramada')
  })

  it('returns the css class for an appointment status', () => {
    expect(getAppointmentStatusClassName('confirmed')).toBe(
      'appointment-status--confirmed',
    )
    expect(getAppointmentStatusClassName('pending')).toBe(
      'appointment-status--pending',
    )
    expect(getAppointmentStatusClassName('cancelled')).toBe(
      'appointment-status--cancelled',
    )
    expect(getAppointmentStatusClassName('completed')).toBe(
      'appointment-status--completed',
    )
    expect(getAppointmentStatusClassName('no_show')).toBe(
      'appointment-status--no-show',
    )
    expect(getAppointmentStatusClassName('rescheduled')).toBe(
      'appointment-status--rescheduled',
    )
  })
})
