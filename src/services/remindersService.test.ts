import { describe, expect, it } from 'vitest'

import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type { ReminderRecord } from '../types/database'
import {
  mapReminderInputToInsert,
  mapReminderRecordToReminder,
  mapReminderToInput,
} from './remindersService'

const appointment: Appointment = {
  date: '2026-06-22',
  id: 'appointment-1',
  patient: 'Ana Salazar',
  patientId: 'patient-1',
  status: 'confirmed',
  time: '13:00',
  treatment: 'Consulta de emergencia',
}

const patient: Patient = {
  birthDate: '1990-05-20',
  email: 'ana@example.com',
  fullName: 'Ana Salazar',
  id: 'patient-1',
  lastVisit: 'Sin registro',
  nextAppointment: null,
  phone: '+59176543210',
  status: 'active',
}

const reminderRecord: ReminderRecord = {
  appointment_id: 'appointment-1',
  channel: 'whatsapp',
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  delivered_at: null,
  failed_reason: null,
  id: 'reminder-1',
  message: 'Hola Ana',
  metadata: {},
  patient_id: 'patient-1',
  provider_message_id: null,
  read_at: null,
  reminder_type: '24h',
  scheduled_at: '2026-06-21T13:00:00Z',
  sent_at: null,
  status: 'scheduled',
  updated_at: '2026-06-16T12:00:00Z',
}

describe('remindersService mappers', () => {
  it('maps reminder records to the current frontend reminder shape', () => {
    expect(
      mapReminderRecordToReminder(reminderRecord, [appointment], [patient]),
    ).toEqual({
      appointmentDate: '2026-06-22',
      appointmentId: 'appointment-1',
      appointmentStatus: 'confirmed',
      appointmentTime: '13:00',
      failedReason: undefined,
      id: 'reminder-1',
      message: 'Hola Ana',
      patientId: 'patient-1',
      patientName: 'Ana Salazar',
      phone: '+59176543210',
      reminderType: '24h',
      scheduledFor: '2026-06-21T13:00:00Z',
      sentAt: undefined,
      status: 'scheduled',
      statusNote: undefined,
      treatment: 'Consulta de emergencia',
    })
  })

  it('maps appointment-passed metadata to a clear omitted note', () => {
    expect(
      mapReminderRecordToReminder({
        ...reminderRecord,
        metadata: {
          note: 'La cita ya pasó sin envío del recordatorio.',
          reason: 'appointment_passed',
        },
        status: 'skipped',
      }, [appointment], [patient]).statusNote,
    ).toBe('Omitido porque la cita ya pasó.')
  })

  it('keeps the original occurrence stored with an omitted reminder', () => {
    const mappedReminder = mapReminderRecordToReminder(
      {
        ...reminderRecord,
        metadata: {
          appointment_date: '2026-06-15',
          appointment_status: 'pending',
          appointment_time: '10:00',
          reason: 'appointment_passed',
        },
        status: 'skipped',
      },
      [
        {
          ...appointment,
          date: '2026-06-29',
          status: 'rescheduled',
          time: '14:00',
        },
      ],
      [patient],
    )

    expect(mappedReminder).toMatchObject({
      appointmentDate: '2026-06-15',
      appointmentStatus: 'pending',
      appointmentTime: '10:00',
      status: 'skipped',
    })
  })

  it('maps reminder inputs to clinic-scoped inserts', () => {
    expect(
      mapReminderInputToInsert('clinic-1', {
        appointmentId: 'appointment-1',
        message: 'Hola Ana',
        patientId: 'patient-1',
        reminderType: '2h',
        scheduledAt: '2026-06-22T11:00',
        status: 'pending',
      }),
    ).toEqual({
      appointment_id: 'appointment-1',
      channel: 'whatsapp',
      clinic_id: 'clinic-1',
      delivered_at: null,
      failed_reason: null,
      message: 'Hola Ana',
      metadata: {},
      patient_id: 'patient-1',
      provider_message_id: null,
      read_at: null,
      reminder_type: '2h',
      scheduled_at: '2026-06-22T11:00',
      sent_at: null,
      status: 'pending',
    })
  })

  it('does not convert demo reminders with numeric ids into real inserts', () => {
    expect(
      mapReminderToInput({
        appointmentDate: '2026-06-22',
        appointmentId: 1,
        appointmentStatus: 'pending',
        appointmentTime: '13:00',
        id: '1-24h',
        message: 'Hola Ana',
        patientId: 1,
        patientName: 'Ana Salazar',
        phone: '+59176543210',
        reminderType: '24h',
        scheduledFor: '2026-06-21T13:00',
        status: 'scheduled',
        treatment: 'Consulta',
      }),
    ).toBeNull()
  })
})
