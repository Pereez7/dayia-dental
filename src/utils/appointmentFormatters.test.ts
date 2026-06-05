import { describe, expect, it } from 'vitest'
import {
  formatAppointmentDate,
  formatAppointmentTime,
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
    expect(getAppointmentStatusLabel('reminder')).toBe('Recordatorio')
  })
})
