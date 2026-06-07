import { describe, expect, it } from 'vitest'
import type { PatientFormValues } from '../types/Patient'
import {
  hasPatientFormErrors,
  validatePatientForm,
  validateRequired,
} from './patientValidators'

const validFormValues: PatientFormValues = {
  firstName: 'Lucia',
  lastName: 'Vargas',
  phone: '+591 70000000',
  email: '',
  birthDate: '',
}

describe('patientValidators', () => {
  it('returns an error message when a required value is empty', () => {
    expect(validateRequired('   ', 'Campo requerido')).toBe('Campo requerido')
  })

  it('returns an empty message when a required value exists', () => {
    expect(validateRequired('Lucia', 'Campo requerido')).toBe('')
  })

  it('validates required patient form fields', () => {
    expect(
      validatePatientForm({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        birthDate: '',
      }),
    ).toEqual({
      firstName: 'El nombre es requerido',
      lastName: 'El apellido es requerido',
      phone: 'El telefono es requerido',
    })
  })

  it('does not require optional patient form fields', () => {
    expect(validatePatientForm(validFormValues)).toEqual({})
  })

  it('detects when a patient form has errors', () => {
    expect(hasPatientFormErrors({ firstName: 'El nombre es requerido' })).toBe(
      true,
    )
    expect(hasPatientFormErrors({})).toBe(false)
  })
})
