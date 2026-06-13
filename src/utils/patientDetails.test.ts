import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  calculatePatientAge,
  getActivePatientAppointments,
  getNextActivePatientAppointment,
  getPatientAppointments,
  getUpcomingActivePatientAppointments,
  getUpcomingPatientAppointments,
} from './patientDetails'

const patient: Patient = {
  id: 1,
  fullName: 'Mariana Rojas',
  phone: '+59170012345',
  birthDate: '1990-06-10',
  lastVisit: '2026-05-18',
  nextAppointment: null,
  status: 'active',
}

const appointments: Appointment[] = [
  {
    id: 1,
    patientId: 1,
    date: '2026-06-09',
    time: '10:00',
    patient: 'Mariana Rojas',
    treatment: 'Limpieza dental',
    status: 'confirmed',
  },
  {
    id: 2,
    date: '2026-06-08',
    time: '09:00',
    patient: 'Mariana Rojas',
    treatment: 'Evaluación inicial',
    status: 'pending',
  },
  {
    id: 3,
    patientId: 2,
    date: '2026-06-08',
    time: '08:00',
    patient: 'Carlos Medina',
    treatment: 'Endodoncia',
    status: 'confirmed',
  },
  {
    id: 4,
    patientId: 1,
    date: '2026-06-10',
    time: '08:00',
    patient: 'Mariana Rojas',
    treatment: 'Control',
    status: 'cancelled',
  },
  {
    id: 5,
    patientId: 1,
    date: '2026-06-11',
    time: '08:00',
    patient: 'Mariana Rojas',
    treatment: 'Ortodoncia',
    status: 'rescheduled',
  },
]

describe('patientDetails', () => {
  it('calculates age from birth date', () => {
    expect(
      calculatePatientAge('1990-06-10', new Date('2026-06-09T12:00:00')),
    ).toBe(35)
    expect(
      calculatePatientAge('1990-06-10', new Date('2026-06-10T12:00:00')),
    ).toBe(36)
  })

  it('gets patient appointments by patient id or mock patient name fallback', () => {
    expect(getPatientAppointments(patient, appointments).map(({ id }) => id)).toEqual([
      2,
      1,
      4,
      5,
    ])
  })

  it('gets upcoming patient appointments sorted by date and time', () => {
    expect(
      getUpcomingPatientAppointments(
        patient,
        appointments,
        new Date('2026-06-09T08:00:00'),
      ).map(({ id }) => id),
    ).toEqual([1, 4, 5])
  })

  it('gets active patient appointments without cancelled or completed appointments', () => {
    expect(
      getActivePatientAppointments(patient, appointments).map(({ id }) => id),
    ).toEqual([2, 1, 5])
  })

  it('gets the next active patient appointment', () => {
    expect(
      getNextActivePatientAppointment(
        patient,
        appointments,
        new Date('2026-06-10T08:00:00'),
      )?.id,
    ).toBe(5)
  })

  it('gets upcoming active patient appointments', () => {
    expect(
      getUpcomingActivePatientAppointments(
        patient,
        appointments,
        new Date('2026-06-09T08:00:00'),
      ).map(({ id }) => id),
    ).toEqual([1, 5])
  })
})
