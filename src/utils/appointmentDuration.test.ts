import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { BusinessDaySchedule } from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import {
  doesAppointmentFitBusinessHours,
  formatAppointmentTimeRange,
  getAppointmentDuration,
  getAppointmentEndTime,
} from './appointmentDuration'

const daySchedule: BusinessDaySchedule = {
  day: 'friday',
  endTime: '18:00',
  isOpen: true,
  startTime: '08:00',
}

const treatments: Treatment[] = [
  { id: 1, name: 'Limpieza dental', durationMinutes: 45, isActive: true },
]

describe('appointmentDuration', () => {
  it('gets duration from the appointment when it exists', () => {
    const appointment: Appointment = {
      date: '2026-06-12',
      durationMinutes: 60,
      id: 1,
      patient: 'Carlos Medina',
      status: 'pending',
      time: '09:00',
      treatment: 'Limpieza dental',
    }

    expect(getAppointmentDuration(appointment, treatments)).toBe(60)
  })

  it('uses treatment duration for older appointments without duration', () => {
    const appointment: Appointment = {
      date: '2026-06-12',
      id: 1,
      patient: 'Carlos Medina',
      status: 'pending',
      time: '09:00',
      treatment: 'Limpieza dental',
    }

    expect(getAppointmentDuration(appointment, treatments)).toBe(45)
  })

  it('uses a safe fallback for old appointments without resolvable treatment', () => {
    const appointment: Appointment = {
      date: '2026-06-12',
      id: 1,
      patient: 'Carlos Medina',
      status: 'pending',
      time: '09:00',
      treatment: 'Tratamiento antiguo',
    }

    expect(getAppointmentDuration(appointment, treatments)).toBe(30)
  })

  it('calculates appointment end time', () => {
    expect(getAppointmentEndTime('09:00', 45)).toBe('09:45')
  })

  it('formats a time range', () => {
    expect(formatAppointmentTimeRange('09:00', 45)).toBe('09:00 - 09:45')
  })

  it('rejects a 60 minute appointment at 17:30 when closing is 18:00', () => {
    expect(doesAppointmentFitBusinessHours(daySchedule, '17:30', 60)).toBe(
      false,
    )
  })

  it('allows a 30 minute appointment at 17:30 when closing is 18:00', () => {
    expect(doesAppointmentFitBusinessHours(daySchedule, '17:30', 30)).toBe(true)
  })
})
