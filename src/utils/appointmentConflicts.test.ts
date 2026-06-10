import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import {
  getAvailableTimeOptions,
  hasAppointmentConflict,
  hasPatientAppointmentOnDate,
} from './appointmentConflicts'

const appointments: Appointment[] = [
  {
    date: '2026-06-10',
    id: 1,
    patient: 'Jorge Quiroga',
    patientId: 1,
    status: 'pending',
    time: '09:00',
    treatment: 'Limpieza dental',
  },
  {
    date: '2026-06-10',
    id: 2,
    patient: 'Ana Salazar',
    patientId: 2,
    status: 'confirmed',
    time: '10:00',
    treatment: 'Evaluación inicial',
  },
  {
    date: '2026-06-11',
    id: 3,
    patient: 'Carlos Medina',
    patientId: 3,
    status: 'rescheduled',
    time: '09:00',
    treatment: 'Control odontológico',
  },
  {
    date: '2026-06-10',
    id: 4,
    patient: 'Mariana Rojas',
    patientId: 4,
    status: 'cancelled',
    time: '11:00',
    treatment: 'Curación dental',
  },
]

const businessHours: BusinessHoursSettings = {
  appointmentInterval: 30,
  weeklySchedule: [
    {
      day: 'wednesday',
      endTime: '11:00',
      isOpen: true,
      startTime: '09:00',
    },
    {
      day: 'thursday',
      endTime: '11:00',
      isOpen: false,
      startTime: '09:00',
    },
  ],
}

describe('hasAppointmentConflict', () => {
  it('returns conflict when an active appointment has the same date and time', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00')).toBe(
      true,
    )
  })

  it('does not return conflict when the time is different', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:30')).toBe(
      false,
    )
  })

  it('does not return conflict when the date is different', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-12', '09:00')).toBe(
      false,
    )
  })

  it('does not return conflict when the existing appointment is cancelled', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '11:00')).toBe(
      false,
    )
  })

  it('returns conflict for pending, confirmed and rescheduled appointments', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00')).toBe(
      true,
    )
    expect(hasAppointmentConflict(appointments, '2026-06-10', '10:00')).toBe(
      true,
    )
    expect(hasAppointmentConflict(appointments, '2026-06-11', '09:00')).toBe(
      true,
    )
  })

  it('ignores the appointment id when requested', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00', 1)).toBe(
      false,
    )
  })
})

describe('hasPatientAppointmentOnDate', () => {
  it('returns true when the patient has an active appointment that day', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-10')).toBe(
      true,
    )
  })

  it('returns false when the appointment is another day', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-11')).toBe(
      false,
    )
  })

  it('returns false when the appointment is cancelled', () => {
    expect(hasPatientAppointmentOnDate(appointments, 4, '2026-06-10')).toBe(
      false,
    )
  })

  it('returns false when the appointment belongs to another patient', () => {
    expect(hasPatientAppointmentOnDate(appointments, 5, '2026-06-10')).toBe(
      false,
    )
  })

  it('ignores the appointment id when requested', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-10', 1)).toBe(
      false,
    )
  })
})

describe('getAvailableTimeOptions', () => {
  it('does not show occupied times', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).not.toContain('09:00')
  })

  it('shows free times', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toContain('09:30')
  })

  it('ignores cancelled appointments', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toContain('10:30')
  })

  it('respects business hours', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toEqual(['09:30', '10:30'])
  })

  it('respects the configured interval', () => {
    expect(
      getAvailableTimeOptions(businessHours, [], '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toEqual(['09:00', '09:30', '10:00', '10:30'])
  })

  it('returns an empty list when the clinic is closed', () => {
    expect(getAvailableTimeOptions(businessHours, [], '2026-06-11')).toEqual([])
  })
})
