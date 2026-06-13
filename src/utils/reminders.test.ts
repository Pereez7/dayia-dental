import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  canMarkReminderAsSent,
  createWhatsAppReminderMessage,
  filterRemindersByAppointmentDate,
  filterRemindersByStatus,
  formatReminderScheduledDateTime,
  generateAppointmentReminders,
  groupRemindersByAppointment,
  groupRemindersByAppointmentDate,
  getReminderDateOptions,
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
      '3-2h',
      '3-24h',
      '1-24h',
      '1-2h',
    ])
    expect(reminders[2]).toMatchObject({
      appointmentId: 1,
      patientId: 1,
      patientName: 'Mariana Rojas',
      phone: '+59170012345',
      status: 'scheduled',
    })
    expect(reminders[0]).toMatchObject({
      appointmentStatus: 'pending',
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
      'Carlos Medina',
      'Carlos Medina',
      'Mariana Rojas',
      'Mariana Rojas',
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
      phone: 'Sin teléfono registrado',
    })
  })

  it('generates only the 2h reminder when the 24h reminder is already in the past', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-10',
          id: 5,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'confirmed',
          time: '09:00',
          treatment: 'Extracción simple',
        },
      ],
      patients,
      new Date('2026-06-09T18:00:00'),
    )

    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      id: '5-2h',
      omittedReminderNotes: [
        'Recordatorio de 24h omitido por registro con poca anticipación.',
      ],
      reminderType: '2h',
      scheduledFor: '2026-06-10T07:00',
      status: 'pending',
    })
  })

  it('creates an immediate confirmation when the appointment is less than 2h away', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-09',
          id: 6,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'confirmed',
          time: '09:00',
          treatment: 'Extracción simple',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      id: '6-immediate',
      message:
        'Hola Mariana, te recordamos tu cita odontológica confirmada para Extracción simple hoy a las 09:00.',
      omittedReminderNotes: [
        'Recordatorios de 24h y 2h omitidos por cita cercana.',
      ],
      reminderType: 'immediate',
      scheduledFor: '2026-06-09T08:00',
      status: 'pending',
    })
  })

  it('does not create reminders for past appointments', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-09',
          id: 7,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'confirmed',
          time: '07:00',
          treatment: 'Extracción simple',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders).toHaveLength(0)
  })

  it('does not create reminders for cancelled appointments', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-12',
          id: 9,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'cancelled',
          time: '09:00',
          treatment: 'Limpieza dental',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(reminders).toHaveLength(0)
  })

  it('creates reminders for rescheduled appointments using their current date and time', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-22',
          id: 12,
          patient: 'Ana Salazar',
          status: 'rescheduled',
          time: '08:30',
          treatment: 'Retiro de brackets',
        },
      ],
      patients,
      new Date('2026-06-20T08:00:00'),
    )

    expect(reminders).toHaveLength(2)
    expect(reminders[0]).toMatchObject({
      appointmentDate: '2026-06-22',
      appointmentStatus: 'rescheduled',
      appointmentTime: '08:30',
      message:
        'Hola Ana, te recordamos que tu cita fue reprogramada para Retiro de brackets el 22 de junio a las 08:30. Por favor confirma tu asistencia.',
      scheduledFor: '2026-06-21T08:30',
    })
  })

  it('never generates scheduled reminders in the past', () => {
    const referenceDate = new Date('2026-06-09T18:00:00')
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-10',
          id: 8,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'confirmed',
          time: '09:00',
          treatment: 'Extracción simple',
        },
      ],
      patients,
      referenceDate,
    )

    expect(
      reminders.every(
        (reminder) =>
          reminder.reminderType === 'immediate' ||
          new Date(reminder.scheduledFor) > referenceDate,
      ),
    ).toBe(true)
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

describe('formatReminderScheduledDateTime', () => {
  it('formats reminder dates with short date and 24-hour time', () => {
    const formattedDate = formatReminderScheduledDateTime('2026-06-15T10:00')

    expect(formattedDate).toBe('15 jun, 10:00')
    expect(formattedDate).not.toContain('a. m.')
    expect(formattedDate).not.toContain('p. m.')
    expect(formattedDate).not.toContain('2026')
  })
})

describe('createWhatsAppReminderMessage', () => {
  it('asks pending appointments to confirm attendance', () => {
    expect(
      createWhatsAppReminderMessage(
        'Mariana Rojas',
        'Limpieza dental',
        '2026-06-10',
        '09:00',
        '24h',
        new Date('2026-06-01T08:00:00'),
      ),
    ).toBe(
      'Hola Mariana, te recordamos tu cita odontológica para Limpieza dental el 10 de junio a las 09:00. Por favor confirma tu asistencia.',
    )
  })

  it('mentions confirmed appointments without asking for confirmation again', () => {
    expect(
      createWhatsAppReminderMessage(
        'Mariana Rojas',
        'Limpieza dental',
        '2026-06-10',
        '09:00',
        '24h',
        new Date('2026-06-01T08:00:00'),
        'confirmed',
      ),
    ).toBe(
      'Hola Mariana, te recordamos tu cita odontológica confirmada para Limpieza dental el 10 de junio a las 09:00.',
    )
  })

  it('mentions rescheduled appointments and asks for confirmation', () => {
    expect(
      createWhatsAppReminderMessage(
        'Ana Salazar',
        'Retiro de brackets',
        '2026-06-22',
        '08:30',
        '2h',
        new Date('2026-06-10T08:00:00'),
        'rescheduled',
      ),
    ).toBe(
      'Hola Ana, te recordamos que tu cita fue reprogramada para Retiro de brackets el 22 de junio a las 08:30. Por favor confirma tu asistencia.',
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

  it('does not count reminders from cancelled appointments', () => {
    const reminders = generateAppointmentReminders(
      [
        ...appointments,
        {
          date: '2026-06-12',
          id: 10,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'cancelled',
          time: '09:00',
          treatment: 'Limpieza dental',
        },
      ],
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

describe('filterRemindersByAppointmentDate', () => {
  it('filters reminders by appointment date', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(filterRemindersByAppointmentDate(reminders, '2026-06-10')).toEqual([
      expect.objectContaining({ id: '1-24h' }),
      expect.objectContaining({ id: '1-2h' }),
    ])
  })

  it('returns all reminders when no date is selected', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(filterRemindersByAppointmentDate(reminders, null)).toHaveLength(4)
  })
})

describe('getReminderDateOptions', () => {
  it('creates sorted compact date options from future reminders', () => {
    const reminders = generateAppointmentReminders(
      [
        ...appointments,
        {
          date: '2026-06-12',
          id: 4,
          patient: 'Mariana Rojas',
          patientId: 1,
          status: 'confirmed',
          time: '12:00',
          treatment: 'Control odontologico',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(
      getReminderDateOptions(reminders, new Date('2026-06-10T08:00:00')),
    ).toEqual([
      {
        appointmentDate: '2026-06-10',
        dateLabel: '10 jun',
        fullLabel: 'Hoy, 10 de junio',
        weekdayLabel: 'Hoy',
      },
      {
        appointmentDate: '2026-06-11',
        dateLabel: '11 jun',
        fullLabel: 'Mañana, 11 de junio',
        weekdayLabel: 'Mañana',
      },
      {
        appointmentDate: '2026-06-12',
        dateLabel: '12 jun',
        fullLabel: 'Viernes, 12 de junio',
        weekdayLabel: 'Vie',
      },
    ])
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
        label: 'Hoy, 10 de junio',
      }),
      expect.objectContaining({
        appointmentDate: '2026-06-11',
        appointmentGroups: [expect.objectContaining({ appointmentId: 3 })],
        label: 'Mañana, 11 de junio',
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

    expect(updateReminderStatus(reminders, '1-2h', 'sent')[3].status).toBe(
      'sent',
    )
    expect(updateReminderStatus(reminders, '1-2h', 'sent')[2].status).toBe(
      'scheduled',
    )
  })
})

describe('canMarkReminderAsSent', () => {
  it('does not allow marking reminders as sent when phone is missing', () => {
    const reminders = generateAppointmentReminders(
      [
        {
          date: '2026-06-12',
          id: 11,
          patient: 'Paciente Externo',
          status: 'pending',
          time: '11:00',
          treatment: 'Control',
        },
      ],
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(canMarkReminderAsSent(reminders[0])).toBe(false)
  })

  it('allows marking reminders as sent when phone exists', () => {
    const reminders = generateAppointmentReminders(
      appointments,
      patients,
      new Date('2026-06-09T08:00:00'),
    )

    expect(canMarkReminderAsSent(reminders[0])).toBe(true)
  })
})
