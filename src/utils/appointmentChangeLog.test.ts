import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import {
  appendAppointmentLogEntry,
  createAppointmentCancelledLog,
  createAppointmentConfirmedLog,
  createAppointmentCreatedLog,
  createAppointmentLogEntry,
  createAppointmentRescheduledLog,
  getAppointmentLogDisplayText,
  getAppointmentLogSummary,
  getLatestAppointmentLogEntry,
} from './appointmentChangeLog'

const createdAt = new Date('2026-06-11T15:30:00Z')

const appointment: Appointment = {
  date: '2026-06-13',
  id: 1,
  patient: 'Carlos Medina',
  patientId: 2,
  status: 'pending',
  time: '09:00',
  treatment: 'Evaluación inicial',
}

describe('appointment change log', () => {
  it('creates an event with the requested type', () => {
    expect(
      createAppointmentLogEntry('confirmed', 'Cita confirmada.', undefined, createdAt),
    ).toMatchObject({
      createdAt: '2026-06-11T15:30:00.000Z',
      description: 'Cita confirmada.',
      type: 'confirmed',
    })
  })

  it('appends an event without mutating previous history', () => {
    const firstEntry = createAppointmentCreatedLog(appointment, createdAt)
    const secondEntry = createAppointmentConfirmedLog(createdAt)
    const appointmentWithHistory = appendAppointmentLogEntry(
      appointment,
      firstEntry,
    )
    const updatedAppointment = appendAppointmentLogEntry(
      appointmentWithHistory,
      secondEntry,
    )

    expect(appointment.changeLog).toBeUndefined()
    expect(appointmentWithHistory.changeLog).toEqual([firstEntry])
    expect(updatedAppointment.changeLog).toEqual([firstEntry, secondEntry])
    expect(updatedAppointment.changeLog).not.toBe(
      appointmentWithHistory.changeLog,
    )
  })

  it('creates a confirmation log', () => {
    expect(createAppointmentConfirmedLog(createdAt)).toMatchObject({
      description: 'Cita confirmada.',
      type: 'confirmed',
    })
  })

  it('creates a cancellation log with reason', () => {
    expect(
      createAppointmentCancelledLog(
        {
          reason: 'Paciente solicitó cancelar',
        },
        createdAt,
      ),
    ).toMatchObject({
      description: 'Cita cancelada. Motivo: Paciente solicitó cancelar.',
      metadata: {
        reason: 'Paciente solicitó cancelar',
      },
      type: 'cancelled',
    })
  })

  it('creates a reschedule log with previous and next date and time', () => {
    expect(
      createAppointmentRescheduledLog(
        appointment,
        {
          date: '2026-06-27',
          time: '09:00',
        },
        {
          reason: 'Solicitud del paciente',
        },
        createdAt,
      ),
    ).toMatchObject({
      description:
        'Cita reprogramada del 13 de junio a las 09:00 al 27 de junio a las 09:00. Motivo: Solicitud del paciente.',
      metadata: {
        fromDate: '2026-06-13',
        fromTime: '09:00',
        reason: 'Solicitud del paciente',
        toDate: '2026-06-27',
        toTime: '09:00',
      },
      type: 'rescheduled',
    })
  })

  it('handles appointments without previous history', () => {
    const entry = createAppointmentCreatedLog(appointment, createdAt)

    expect(appendAppointmentLogEntry(appointment, entry).changeLog).toEqual([
      entry,
    ])
  })

  it('does not overwrite existing events', () => {
    const firstEntry = createAppointmentCreatedLog(appointment, createdAt)
    const secondEntry = createAppointmentCancelledLog(
      {
        reason: 'Paciente no asistirá',
      },
      createdAt,
    )
    const updatedAppointment = appendAppointmentLogEntry(
      {
        ...appointment,
        changeLog: [firstEntry],
      },
      secondEntry,
    )

    expect(updatedAppointment.changeLog).toEqual([firstEntry, secondEntry])
  })

  it('returns the latest event', () => {
    const firstEntry = createAppointmentCreatedLog(appointment, createdAt)
    const secondEntry = createAppointmentConfirmedLog(createdAt)

    expect(
      getLatestAppointmentLogEntry({
        ...appointment,
        changeLog: [firstEntry, secondEntry],
      }),
    ).toEqual(secondEntry)
  })

  it('formats reschedule display text without repeating the reason', () => {
    const entry = createAppointmentRescheduledLog(
      appointment,
      {
        date: '2026-06-27',
        time: '09:00',
      },
      {
        reason: 'Solicitud del paciente',
      },
      createdAt,
    )

    expect(getAppointmentLogDisplayText(entry)).toBe(
      'Reprogramada de 13 jun, 09:00 a 27 jun, 09:00.',
    )
  })

  it('formats cancellation display text without repeating the reason', () => {
    const entry = createAppointmentCancelledLog(
      {
        reason: 'Paciente solicitó cancelar',
      },
      createdAt,
    )

    expect(getAppointmentLogDisplayText(entry)).toBe('Cancelada.')
  })

  it('formats the latest change summary with the event timestamp first', () => {
    const entry = createAppointmentRescheduledLog(
      {
        ...appointment,
        date: '2026-06-13',
        time: '08:30',
      },
      {
        date: '2026-06-15',
        time: '13:30',
      },
      {
        reason: 'Cambio de disponibilidad del doctor',
      },
      new Date('2026-06-12T15:16:00'),
    )

    expect(getAppointmentLogSummary(entry)).toBe(
      'Ultimo cambio 12 jun, 15:16: Reprogramada de 13 jun, 08:30 a 15 jun, 13:30.',
    )
  })

  it('uses a safe fallback when reschedule metadata is incomplete', () => {
    const entry = createAppointmentLogEntry(
      'rescheduled',
      'Cita reprogramada.',
      {
        fromDate: '2026-06-13',
      },
      createdAt,
    )

    expect(getAppointmentLogSummary(entry)).toContain('Cita reprogramada.')
  })
})
