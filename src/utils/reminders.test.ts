import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  createWhatsAppReminderMessage,
  filterRemindersByStatus,
  generateAppointmentReminders,
  groupRemindersByAppointment,
  groupRemindersByAppointmentDate,
  getScheduledFor,
  summarizeRemindersByStatus,
  updateReminderStatus,
} from './reminders'

const patients: Patient[] = [
  {
    fullName: 'Mariana Rojas',
    id: 1,
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-10',
    phone: '+59170012345',
    status: 'active',
  },
  {
    fullName: 'Carlos Medina',
    id: 2,
    lastVisit: '2026-04-29',
    nextAppointment: '2026-06-11',
    phone: '+59171234567',
    status: 'follow-up',
  },
]

const appointments: Appointment[] = [
  {
    date: '2026-06-10',
    id: 1,
    patient: 'Mariana Rojas',
    patientId: 1,
    status: 'confirmed',
    time: '09:00',
    treatment: 'Limpieza dental',
  },
  {
    date: '2026-06-08',
    id: 2,
    patient: 'Carlos Medina',
    status: 'pending',
    time: '10:00',
    treatment: 'Evaluacion inicial',
  },
  {
    date: '2026-06-11',
    id: 3,
    patient: 'Carlos Medina',
    patientId: 2,
    status: 'pending',
    time: '10:30',
    treatment: 'Evaluacion inicial',
  },
]

describe('generateAppointmentReminders', () => {
  it('creates 24h and 2h reminders only for future appointments', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders).toHaveLength(4)
    expect(reminders.map((reminder) => reminder.id)).toEqual([
      '1-24h',
      '1-2h',
      '3-24h',
      '3-2h',
    ])
    expect(reminders[0]).toMatchObject({
      appointmentId: 1,
      patientId: 1,
      patientName: 'Mariana Rojas',
      phone: '+59170012345',
      status: 'scheduled',
    })
    expect(reminders[1]).toMatchObject({
      status: 'pending',
    })
  })

  it('creates reminders for several future appointments and patients', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders.map((reminder) => reminder.patientName)).toEqual([
      'Mariana Rojas',
      'Mariana Rojas',
      'Carlos Medina',
      'Carlos Medina',
    ])
  })

  it('uses patient name fallback when appointments do not include patientId', () => {
    const reminders = generateAppointmentReminders(
      [{ ...appointments[0], patientId: undefined }],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders[0].patientId).toBe(1)
    expect(reminders[0].phone).toBe('+59170012345')
  })

  it('keeps reminders visible when patient phone is missing', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-12',
          id: 4,
          patient: 'Paciente Externo',
          status: 'pending',
          time: '11:00',
          treatment: 'Control',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders).toHaveLength(2)
    expect(reminders[0]).toMatchObject({
      patientId: null,
      phone: 'Sin telefono registrado',
    })
  })
})

describe('getScheduledFor', () => {
  it('calculates the scheduled reminder date and time', () => {
    expect(getScheduledFor('2026-06-10', '09:00', '24h')).toBe(
      '2026-06-09T09:00',
    )
    expect(getScheduledFor('2026-06-10', '09:00', '2h')).toBe(
      '2026-06-10T07:00',
    )
  })
})

describe('createWhatsAppReminderMessage', () => {
  it('creates a suggested message with appointment data', () => {
    expect(
      createWhatsAppReminderMessage(
        'Mariana Rojas',
        'Limpieza dental',
        '2026-06-10',
        '09:00',
      ),
    ).toBe(
      'Hola Mariana, te recordamos tu cita odontologica para Limpieza dental el 10-jun-2026 a las 09:00. Por favor confirma tu asistencia.',
    )
  })
})

describe('summarizeRemindersByStatus', () => {
  it('counts reminders by status', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(summarizeRemindersByStatus(reminders)).toEqual({
      failed: 0,
      pending: 2,
      scheduled: 2,
      sent: 0,
    })
  })
})

describe('filterRemindersByStatus', () => {
  it('filters reminders by status or returns all reminders', () => {
    const reminders = updateReminderStatus(
      generateAppointmentReminders(
        appointments,
        patients,
        new Date('2026-06-09T08:00:00'),
      ),
      '1-2h',
      'sent',
    )

    expect(filterRemindersByStatus(reminders, 'all')).toHaveLength(4)
    expect(filterRemindersByStatus(reminders, 'sent')).toHaveLength(1)
    expect(filterRemindersByStatus(reminders, 'pending')).toHaveLength(1)
  })
})

describe('groupRemindersByAppointment', () => {
  it('groups several reminders into one appointment card', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(groupRemindersByAppointment(reminders)).toEqual([
      expect.objectContaining({
        appointmentId: 1,
        patientName: 'Mariana Rojas',
        reminders: [
          expect.objectContaining({ id: '1-24h' }),
          expect.objectContaining({ id: '1-2h' }),
        ],
      }),
      expect.objectContaining({
        appointmentId: 3,
        patientName: 'Carlos Medina',
        reminders: [
          expect.objectContaining({ id: '3-24h' }),
          expect.objectContaining({ id: '3-2h' }),
        ],
      }),
    ])
  })

  it('keeps only appointments that still match a filtered reminder list', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )
    const pendingReminders = filterRemindersByStatus(reminders, 'pending')

    expect(groupRemindersByAppointment(pendingReminders)).toHaveLength(2)
    expect(groupRemindersByAppointment(pendingReminders)[0].reminders).toHaveLength(
      1,
    )
  })
})

describe('groupRemindersByAppointmentDate', () => {
  it('groups appointment cards by appointment date with readable labels', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-10T08:00:00'),
    )

    expect(
      groupRemindersByAppointmentDate(
        reminders,
        new Date('2026-06-10T08:00:00'),
      ),
    ).toEqual([
      expect.objectContaining({
        appointmentDate: '2026-06-10',
        appointmentGroups: [expect.objectContaining({ appointmentId: 1 })],
        label: 'Hoy, 10-jun-2026',
      }),
      expect.objectContaining({
        appointmentDate: '2026-06-11',
        appointmentGroups: [expect.objectContaining({ appointmentId: 3 })],
        label: 'Mañana, 11-jun-2026',
      }),
    ])
  })
})

describe('updateReminderStatus', () => {
  it('updates only the selected reminder', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(updateReminderStatus(reminders, '1-2h', 'sent')[1].status).toBe(
      'sent',
    )
    expect(updateReminderStatus(reminders, '1-2h', 'sent')[0].status).toBe(
      'scheduled',
    )
  })
})
