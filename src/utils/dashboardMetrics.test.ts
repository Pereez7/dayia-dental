import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getDashboardActivityMessages,
  getDashboardSummary,
  getMonthlyAppointments,
  getRecentPatients,
  getTodayAppointments,
  getUpcomingAppointments,
} from './dashboardMetrics'

const appointments: Appointment[] = [
  {
    id: 1,
    date: '2026-06-07',
    time: '09:00',
    patient: 'Pasada',
    treatment: 'Control',
    status: 'confirmed',
  },
  {
    id: 2,
    date: '2026-06-08',
    time: '10:30',
    patient: 'Hoy tarde',
    treatment: 'Limpieza dental',
    status: 'pending',
  },
  {
    id: 3,
    date: '2026-06-08',
    time: '08:30',
    patient: 'Hoy temprano',
    treatment: 'Evaluación inicial',
    status: 'confirmed',
  },
  {
    id: 4,
    date: '2026-06-09',
    time: '11:00',
    patient: 'Mañana',
    treatment: 'Endodoncia',
    status: 'rescheduled',
  },
]

const patients: Patient[] = [
  {
    id: 1,
    fullName: 'Mariana Rojas',
    phone: '+59170012345',
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-08',
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Carlos Medina',
    phone: '+59171234567',
    lastVisit: '2026-04-29',
    nextAppointment: null,
    status: 'follow-up',
  },
]

describe('dashboardMetrics', () => {
  const referenceDate = new Date('2026-06-08T12:00:00')

  it('calculates dashboard summary from upcoming appointments and patients', () => {
    expect(getDashboardSummary(appointments, patients, referenceDate)).toEqual({
      monthlyAppointments: 4,
      monthlyRescheduledAppointments: 1,
      pendingAppointments: 1,
      registeredPatients: 2,
      todayAppointments: 2,
    })
  })

  it('gets todays appointments sorted by time', () => {
    expect(getTodayAppointments(appointments, referenceDate).map(({ id }) => id)).toEqual([
      3,
      2,
    ])
  })

  it('gets upcoming appointments without past appointments', () => {
    expect(getUpcomingAppointments(appointments, 2, referenceDate).map(({ id }) => id)).toEqual([
      3,
      2,
    ])
  })

  it('gets appointments from the current month', () => {
    expect(getMonthlyAppointments(appointments, referenceDate).map(({ id }) => id)).toEqual([
      1,
      3,
      2,
      4,
    ])
  })

  it('gets recent patients from the current patient order', () => {
    expect(getRecentPatients(patients, 1)).toEqual([patients[0]])
  })

  it('creates operational activity messages from current appointments', () => {
    expect(getDashboardActivityMessages(appointments, referenceDate)).toEqual([
      'Hoy tienes 2 atenciones programadas.',
      'Tienes 1 citas pendientes por confirmar.',
      'Este mes tienes 4 atenciones registradas.',
      'Hay 1 citas reprogramadas este mes.',
    ])
  })

})
