import { describe, expect, it } from 'vitest'
import type { AppointmentFormValues } from '../types/Appointment'
import {
  hasAppointmentFormErrors,
  validateAppointmentForm,
} from './appointmentValidators'

const validAppointmentFormValues: AppointmentFormValues = {
  patient: 'Mariana Rojas',
  date: '2026-06-12',
  time: '09:30',
  treatment: 'Limpieza dental',
  status: 'pending',
}

describe('validateAppointmentForm', () => {
  it('returns no errors when values are valid', () => {
    expect(
      validateAppointmentForm(
        validAppointmentFormValues,
        new Date('2026-06-08T10:00:00'),
      ),
    ).toEqual({})
  })

  it('requires a patient', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        patient: '',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.patient).toBe('Selecciona un paciente.')
  })

  it('requires a date', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        date: '',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.date).toBe('Selecciona una fecha.')
  })

  it('does not allow a date before today', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        date: '2026-06-07',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.date).toBe('La fecha no puede ser anterior a hoy.')
  })

  it('allows today as appointment date', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        date: '2026-06-08',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.date).toBeUndefined()
  })

  it('requires a time', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        time: '',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.time).toBe('Selecciona una hora.')
  })

  it('requires a treatment', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        treatment: '   ',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.treatment).toBe('Ingresa el motivo o tratamiento.')
  })

  it('allows only valid initial statuses', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        status: 'rescheduled',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.status).toBe('Selecciona un estado valido.')
  })

  it('does not allow cancelled or completed as initial statuses', () => {
    expect(
      validateAppointmentForm({
        ...validAppointmentFormValues,
        status: 'cancelled',
      }, new Date('2026-06-08T10:00:00')).status,
    ).toBe('Selecciona un estado valido.')
    expect(
      validateAppointmentForm({
        ...validAppointmentFormValues,
        status: 'completed',
      }, new Date('2026-06-08T10:00:00')).status,
    ).toBe('Selecciona un estado valido.')
  })

  it('requires a treatment from the defined catalog', () => {
    const errors = validateAppointmentForm(
      {
        ...validAppointmentFormValues,
        treatment: 'Tratamiento inventado',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.treatment).toBe('Selecciona un tratamiento valido.')
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
