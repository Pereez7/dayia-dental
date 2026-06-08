import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import { sortAppointmentsByDateTime } from './appointmentSorters'

const appointments: Appointment[] = [
  {
    id: 1,
    date: '2026-06-08',
    time: '12:00',
    patient: 'Ana Salazar',
    treatment: 'Control de ortodoncia',
    status: 'rescheduled',
  },
  {
    id: 2,
    date: '2026-06-07',
    time: '10:30',
    patient: 'Carlos Medina',
    treatment: 'Evaluacion inicial',
    status: 'pending',
  },
  {
    id: 3,
    date: '2026-06-07',
    time: '09:00',
    patient: 'Mariana Rojas',
    treatment: 'Limpieza dental',
    status: 'confirmed',
  },
]

describe('sortAppointmentsByDateTime', () => {
  it('sorts appointments by date and time', () => {
    expect(
      sortAppointmentsByDateTime(appointments).map((item) => item.id),
    ).toEqual([3, 2, 1])
  })

  it('returns an empty list when there are no appointments', () => {
    expect(sortAppointmentsByDateTime([])).toEqual([])
  })

  it('does not mutate the original list', () => {
    const originalIds = appointments.map((item) => item.id)

    sortAppointmentsByDateTime(appointments)

    expect(appointments.map((item) => item.id)).toEqual(originalIds)
  })
})
