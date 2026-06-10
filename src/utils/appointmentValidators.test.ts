import { describe, expect, it } from 'vitest'
import type { AppointmentFormValues } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import {
  hasAppointmentFormErrors,
  validateAppointmentForm,
} from './appointmentValidators'

const activeTreatments: Treatment[] = [
  { id: 1, name: 'Limpieza dental', isActive: true },
  { id: 2, name: 'Endodoncia', isActive: false },
]

const businessHours: BusinessHoursSettings = {
  appointmentInterval: 30,
  weeklySchedule: [
    {
      day: 'friday',
      endTime: '18:00',
      isOpen: true,
      startTime: '08:00',
    },
    {
      day: 'saturday',
      endTime: '12:00',
      isOpen: true,
      startTime: '08:00',
    },
    {
      day: 'sunday',
      endTime: '12:00',
      isOpen: false,
      startTime: '08:00',
    },
  ],
}

const validAppointmentFormValues: AppointmentFormValues = {
  patientId: 1,
  patient: 'Mariana Rojas',
  date: '2026-06-12',
  time: '09:30',
  treatment: 'Limpieza dental',
  status: 'pending',
}

function validate(values: AppointmentFormValues) {
  return validateAppointmentForm(
    values,
    new Date('2026-06-08T10:00:00'),
    activeTreatments,
    businessHours,
  )
}

describe('validateAppointmentForm', () => {
  it('returns no errors when values are valid', () => {
    expect(validate(validAppointmentFormValues)).toEqual({})
  })

  it('requires a patient', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      patientId: null,
      patient: '',
    })

    expect(errors.patient).toBe('Selecciona un paciente.')
  })

  it('validates the selected patient id instead of the search text', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      patientId: null,
      patient: 'Carlos Medina',
    })

    expect(errors.patient).toBe('Selecciona un paciente.')
  })

  it('requires a date', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '',
    })

    expect(errors.date).toBe('Selecciona una fecha.')
  })

  it('does not allow a date before today', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-07',
    })

    expect(errors.date).toBe('La fecha no puede ser anterior a hoy.')
  })

  it('allows today as appointment date', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-08',
    })

    expect(errors.date).toBeUndefined()
  })

  it('requires a time', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      time: '',
    })

    expect(errors.time).toBe('Selecciona una hora.')
  })

  it('requires a time from the configured slot catalog', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      time: '10:10',
    })

    expect(errors.time).toBe('Selecciona una hora valida.')
  })

  it('rejects appointments when the clinic is closed that day', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-14',
      time: '09:00',
    })

    expect(errors.date).toBe('El consultorio está cerrado ese día.')
  })

  it('rejects a time before opening', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-12',
      time: '07:30',
    })

    expect(errors.time).toBe(
      'La hora seleccionada está fuera del horario de atención.',
    )
  })

  it('rejects a time after closing', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-12',
      time: '18:30',
    })

    expect(errors.time).toBe(
      'La hora seleccionada está fuera del horario de atención.',
    )
  })

  it('allows a different saturday schedule', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-13',
      time: '11:30',
    })

    expect(errors.time).toBeUndefined()
  })

  it('keeps past dates invalid before business hours validation', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      date: '2026-06-07',
      time: '09:00',
    })

    expect(errors.date).toBe('La fecha no puede ser anterior a hoy.')
  })

  it('requires a treatment', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      treatment: '   ',
    })

    expect(errors.treatment).toBe('Ingresa el motivo o tratamiento.')
  })

  it('allows only valid initial statuses', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      status: 'rescheduled',
    })

    expect(errors.status).toBe('Selecciona un estado valido.')
  })

  it('does not allow cancelled or completed as initial statuses', () => {
    expect(
      validate({
        ...validAppointmentFormValues,
        status: 'cancelled',
      }).status,
    ).toBe('Selecciona un estado valido.')
    expect(
      validate({
        ...validAppointmentFormValues,
        status: 'completed',
      }).status,
    ).toBe('Selecciona un estado valido.')
  })

  it('requires a treatment from the active treatment catalog', () => {
    const errors = validate({
      ...validAppointmentFormValues,
      treatment: 'Endodoncia',
    })

    expect(errors.treatment).toBe('Selecciona un tratamiento valido.')
  })

  it('requires at least one active treatment', () => {
    const errors = validateAppointmentForm(
      validAppointmentFormValues,
      new Date('2026-06-08T10:00:00'),
      [{ id: 1, name: 'Limpieza dental', isActive: false }],
      businessHours,
    )

    expect(errors.treatment).toBe(
      'Activa al menos un tratamiento en Configuracion.',
    )
  })
})

describe('hasAppointmentFormErrors', () => {
  it('returns true when at least one error exists', () => {
    expect(hasAppointmentFormErrors({ date: 'Selecciona una fecha.' })).toBe(
      true,
    )
  })

  it('returns false when there are no errors', () => {
    expect(hasAppointmentFormErrors({})).toBe(false)
  })
})
