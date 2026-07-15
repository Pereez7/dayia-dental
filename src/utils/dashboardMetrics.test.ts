import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getAppointmentsRequiringAttention,
  getDashboardActivityMessages,
  getDashboardSummary,
  getMonthlyAppointments,
  getMonthlyStatusSummary,
  getRecentAppointmentActivity,
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
    changeLog: [
      {
        id: 'created-1',
        type: 'created',
        createdAt: '2026-06-01T09:00:00.000Z',
        description: 'Cita creada.',
      },
    ],
  },
  {
    id: 2,
    date: '2026-06-08',
    time: '10:30',
    patient: 'Hoy tarde',
    patientId: 1,
    treatment: 'Limpieza dental',
    status: 'pending',
  },
  {
    id: 3,
    date: '2026-06-08',
    time: '08:30',
    patient: 'Hoy temprano',
    patientId: 2,
    treatment: 'Evaluación inicial',
    status: 'confirmed',
    changeLog: [
      {
        id: 'confirmed-3',
        type: 'confirmed',
        createdAt: '2026-06-08T13:30:00.000Z',
        description: 'Cita confirmada.',
      },
    ],
  },
  {
    id: 4,
    date: '2026-06-09',
    time: '11:00',
    patient: 'Mañana',
    treatment: 'Endodoncia',
    status: 'rescheduled',
    changeLog: [
      {
        id: 'created-4',
        type: 'created',
        createdAt: '2026-06-01T09:00:00.000Z',
        description: 'Cita creada.',
      },
      {
        id: 'rescheduled-4',
        type: 'rescheduled',
        createdAt: '2026-06-08T14:30:00.000Z',
        description: 'Cita reprogramada.',
        metadata: {
          fromDate: '2026-06-08',
          fromTime: '11:00',
          toDate: '2026-06-09',
          toTime: '11:00',
        },
      },
    ],
  },
  {
    id: 5,
    date: '2026-06-10',
    time: '09:00',
    patient: 'Cancelada futura',
    treatment: 'Control',
    status: 'cancelled',
    changeLog: [
      {
        id: 'cancelled-5',
        type: 'cancelled',
        createdAt: '2026-06-08T15:30:00.000Z',
        description: 'Cita cancelada.',
      },
    ],
  },
  {
    id: 6,
    date: '2026-06-08',
    time: '12:00',
    patient: 'Cancelada hoy',
    treatment: 'Control',
    status: 'cancelled',
  },
  {
    id: 7,
    date: '2026-07-02',
    time: '09:00',
    patient: 'Movida fuera del mes',
    treatment: 'Control',
    status: 'rescheduled',
    changeLog: [
      {
        id: 'rescheduled-7',
        type: 'rescheduled',
        createdAt: '2026-06-20T15:00:00.000Z',
        description: 'Cita reprogramada.',
      },
    ],
  },
]

const patients: Patient[] = [
  {
    id: 1,
    fullName: 'Hoy tarde',
    phone: '+59170012345',
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-08',
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Hoy temprano',
    phone: '',
    lastVisit: '2026-04-29',
    nextAppointment: null,
    status: 'follow-up',
  },
  {
    id: 3,
    fullName: 'Paciente inactivo',
    phone: '+59170000000',
    lastVisit: '2026-01-10',
    nextAppointment: null,
    status: 'inactive',
  },
]

describe('dashboardMetrics', () => {
  const referenceDate = new Date(2026, 5, 8, 12)

  it('calculates dashboard summary from today, month and patients', () => {
    expect(getDashboardSummary(appointments, patients, referenceDate)).toEqual({
      monthlyCancelledAppointments: 2,
      monthlyRescheduledAppointments: 2,
      registeredPatients: 2,
      todayAppointments: 2,
      todayConfirmedAppointments: 1,
      todayPendingAppointments: 1,
    })
  })

  it('gets todays appointments sorted by time', () => {
    expect(getTodayAppointments(appointments, referenceDate).map(({ id }) => id)).toEqual([
      3,
      2,
    ])
  })

  it('gets appointments from the current month', () => {
    expect(getMonthlyAppointments(appointments, referenceDate).map(({ id }) => id)).toEqual([
      1,
      3,
      2,
      6,
      4,
      5,
    ])
  })

  it('counts monthly appointment statuses', () => {
    expect(getMonthlyStatusSummary(appointments, referenceDate)).toEqual({
      cancelled: 2,
      confirmed: 2,
      rescheduled: 2,
      total: 6,
    })
  })

  it('gets upcoming appointments sorted by date and time without cancelled appointments', () => {
    expect(getUpcomingAppointments(appointments, 10, referenceDate).map(({ id }) => id)).toEqual([
      4,
      7,
    ])
  })

  it('gets recent patients from the current patient order', () => {
    expect(getRecentPatients(patients, 1)).toEqual([patients[0]])
  })

  it('creates attention items from active pending and recent rescheduled appointments', () => {
    expect(
      getAppointmentsRequiringAttention(appointments, 5, referenceDate)
        .map(({ id }) => id),
    ).toEqual(['pending-2', 'rescheduled-4'])
  })

  it('gets real appointment activity including created events', () => {
    expect(getRecentAppointmentActivity(appointments, 5)).toEqual([
      {
        description: 'Cita reprogramada',
        id: '7-rescheduled-7',
        occurredAt: '2026-06-20T15:00:00.000Z',
        patient: 'Movida fuera del mes',
      },
      {
        description: 'Cita cancelada',
        id: '5-cancelled-5',
        occurredAt: '2026-06-08T15:30:00.000Z',
        patient: 'Cancelada futura',
      },
      {
        description: 'Reprogramada de 8 jun, 11:00 a 9 jun, 11:00',
        id: '4-rescheduled-4',
        occurredAt: '2026-06-08T14:30:00.000Z',
        patient: 'Mañana',
      },
      {
        description: 'Cita confirmada',
        id: '3-confirmed-3',
        occurredAt: '2026-06-08T13:30:00.000Z',
        patient: 'Hoy temprano',
      },
      {
        description: 'Cita creada',
        id: '1-created-1',
        occurredAt: '2026-06-01T09:00:00.000Z',
        patient: 'Pasada',
      },
    ])
  })

  it('excludes cancelled and completed appointments from today and upcoming totals', () => {
    const completed: Appointment = {
      id: 8,
      date: '2026-06-08',
      time: '13:00',
      patient: 'Completada',
      treatment: 'Control',
      status: 'completed',
    }

    expect(
      getTodayAppointments([...appointments, completed], referenceDate).map(
        ({ id }) => id,
      ),
    ).toEqual([3, 2])
    expect(
      getUpcomingAppointments([...appointments, completed], 10, referenceDate).map(
        ({ id }) => id,
      ),
    ).toEqual([4, 7])
  })

  it('uses status as a monthly fallback when no change log exists', () => {
    const withoutLogs = appointments.map((appointment) => ({
      ...appointment,
      changeLog: undefined,
    }))

    expect(getMonthlyStatusSummary(withoutLogs, referenceDate)).toEqual({
      cancelled: 2,
      confirmed: 2,
      rescheduled: 1,
      total: 6,
    })
  })

  it('uses the local calendar day around a UTC boundary', () => {
    const localReference = new Date(2026, 5, 8, 0, 15)

    expect(getTodayAppointments(appointments, localReference).map(({ id }) => id)).toEqual([
      3,
      2,
    ])
  })

  it('creates operational activity messages from today and month data', () => {
    expect(getDashboardActivityMessages(appointments, referenceDate)).toEqual([
      'Hoy tienes 2 atenciones programadas.',
      'Tienes 1 citas pendientes de hoy por confirmar.',
      'Este mes tienes 6 atenciones registradas.',
      'Hay 2 citas reprogramadas este mes.',
    ])
  })
})
