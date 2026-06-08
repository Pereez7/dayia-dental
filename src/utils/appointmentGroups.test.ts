import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import {
  getAgendaDateLabel,
  groupAppointmentsByDate,
  summarizeAppointmentsByStatus,
} from './appointmentGroups'

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

describe('appointmentGroups', () => {
  it('groups appointments by date in date and time order', () => {
    const groups = groupAppointmentsByDate(appointments)

    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-06-07')
    expect(groups[0].appointments.map((appointment) => appointment.id)).toEqual([
      3, 2,
    ])
    expect(groups[1].date).toBe('2026-06-08')
  })

  it('returns friendly labels for today and tomorrow', () => {
    const referenceDate = new Date('2026-06-07T00:00:00')

    expect(getAgendaDateLabel('2026-06-07', referenceDate)).toBe('Hoy, 07-jun')
    expect(getAgendaDateLabel('2026-06-08', referenceDate)).toBe(
      'Mañana, 08-jun',
    )
    expect(getAgendaDateLabel('2026-06-09', referenceDate)).toBe('09-jun')
  })

  it('summarizes appointments by status', () => {
    expect(summarizeAppointmentsByStatus(appointments)).toEqual({
      cancelled: 0,
      completed: 0,
      confirmed: 1,
      pending: 1,
      rescheduled: 1,
    })
  })
})
