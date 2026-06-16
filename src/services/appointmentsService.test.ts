import { describe, expect, it } from 'vitest'

import type {
  AppointmentChangeLogRecord,
  AppointmentRecord,
} from '../types/database'
import type { Patient } from '../types/Patient'
import {
  mapAppointmentFormValuesToAppointmentInput,
  mapAppointmentInputToInsert,
  mapAppointmentRecordToAppointment,
} from './appointmentsService'

const appointmentRecord: AppointmentRecord = {
  appointment_date: '2026-06-22',
  cancel_reason: null,
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  duration_minutes: 30,
  id: 'appointment-1',
  patient_id: 'patient-1',
  reason: 'Consulta de emergencia',
  reschedule_reason: null,
  start_time: '13:00:00',
  status: 'pending',
  treatment_id: null,
  updated_at: '2026-06-16T12:00:00Z',
}

const changeLogRecord: AppointmentChangeLogRecord = {
  appointment_id: 'appointment-1',
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:05:00Z',
  description: 'Cita creada para Consulta de emergencia.',
  from_date: null,
  from_time: null,
  id: 'log-1',
  to_date: null,
  to_time: null,
  type: 'created',
}

const patients: Patient[] = [
  {
    birthDate: '1990-05-20',
    email: 'ana@example.com',
    fullName: 'Ana Salazar',
    id: 'patient-1',
    lastVisit: 'Sin registro',
    nextAppointment: null,
    phone: '+59176543210',
    status: 'active',
  },
]

describe('appointmentsService mappers', () => {
  it('maps an appointment record to the current frontend appointment shape', () => {
    expect(
      mapAppointmentRecordToAppointment(appointmentRecord, patients, [
        changeLogRecord,
      ]),
    ).toEqual({
      id: 'appointment-1',
      cancellationReason: undefined,
      changeLog: [
        {
          createdAt: '2026-06-16T12:05:00Z',
          description: 'Cita creada para Consulta de emergencia.',
          id: 'log-1',
          metadata: {},
          type: 'created',
        },
      ],
      date: '2026-06-22',
      durationMinutes: 30,
      patient: 'Ana Salazar',
      patientId: 'patient-1',
      rescheduleReason: undefined,
      status: 'pending',
      time: '13:00',
      treatment: 'Consulta de emergencia',
    })
  })

  it('returns null when a demo numeric patient id is sent to the real mapper', () => {
    expect(
      mapAppointmentFormValuesToAppointmentInput({
        date: '2026-06-22',
        durationMinutes: 30,
        patient: 'Ana Salazar',
        patientId: 1,
        status: 'pending',
        time: '13:00',
        treatment: 'Consulta de emergencia',
      }),
    ).toBeNull()
  })

  it('maps appointment input to a clinic-scoped insert payload', () => {
    expect(
      mapAppointmentInputToInsert('clinic-1', {
        date: '2026-06-22',
        durationMinutes: 30,
        patientId: 'patient-1',
        patientName: 'Ana Salazar',
        status: 'pending',
        time: '13:00',
        treatment: 'Consulta de emergencia',
        treatmentId: null,
      }),
    ).toEqual({
      appointment_date: '2026-06-22',
      cancel_reason: null,
      clinic_id: 'clinic-1',
      duration_minutes: 30,
      patient_id: 'patient-1',
      reason: 'Consulta de emergencia',
      reschedule_reason: null,
      start_time: '13:00',
      status: 'pending',
      treatment_id: null,
    })
  })
})
