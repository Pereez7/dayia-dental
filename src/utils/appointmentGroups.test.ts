import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import {
  getAgendaDayOption,
  getAgendaDateLabel,
  getAppointmentsForDate,
  getDateInputValue,
  getVisibleAgendaDays,
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
  {
    id: 4,
    date: '2026-06-07',
    time: '11:00',
    patient: 'Lucia Vargas',
    treatment: 'Revision post tratamiento',
    status: 'cancelled',
  },
]

describe('appointmentGroups', () => {
  it('groups appointments by date in date and time order', () => {
    const groups = groupAppointmentsByDate(appointments)

    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-06-07')
    expect(groups[0].appointments.map((appointment) => appointment.id)).toEqual([
      3, 2, 4,
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
      cancelled: 1,
      completed: 0,
      confirmed: 1,
      pending: 1,
      rescheduled: 1,
    })
  })

  it('formats a date as input value', () => {
    expect(getDateInputValue(new Date('2026-06-07T10:00:00'))).toBe(
      '2026-06-07',
    )
  })

  it('filters appointments for the selected day and orders them by time', () => {
    expect(
      getAppointmentsForDate(appointments, '2026-06-07').map(
        (appointment) => appointment.id,
      ),
    ).toEqual([3, 2, 4])
  })

  it('does not include appointments from other days in the selected day', () => {
    expect(
      getAppointmentsForDate(appointments, '2026-06-08').map(
        (appointment) => appointment.id,
      ),
    ).toEqual([1])
  })

  it('generates visible agenda days with today, tomorrow and future appointment dates', () => {
    const referenceDate = new Date('2026-06-07T00:00:00')

    expect(
      getVisibleAgendaDays(appointments, referenceDate).map((day) => day.date),
    ).toEqual(['2026-06-07', '2026-06-08'])
  })

  it('generates compact labels for today, tomorrow and weekdays', () => {
    const referenceDate = new Date('2026-06-07T00:00:00')

    expect(getAgendaDayOption('2026-06-07', referenceDate)).toMatchObject({
      primaryLabel: 'Hoy',
      secondaryLabel: '07-jun',
    })
    expect(getAgendaDayOption('2026-06-08', referenceDate)).toMatchObject({
      primaryLabel: 'Mañana',
      secondaryLabel: '08-jun',
    })
    expect(getAgendaDayOption('2026-06-09', referenceDate)).toMatchObject({
      primaryLabel: 'mar',
      secondaryLabel: '09-jun',
    })
  })
})
