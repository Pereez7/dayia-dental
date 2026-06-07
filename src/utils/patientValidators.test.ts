import { describe, expect, it } from 'vitest'
import type { PatientFormValues } from '../types/Patient'
import {
  hasPatientFormErrors,
  validateOptionalEmail,
  validatePatientForm,
  validatePersonName,
  validatePhone,
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

  it('allows names with spaces, accents and ñ', () => {
    expect(validatePersonName('María José', 'El nombre')).toBe('')
    expect(validatePersonName('Peña', 'El apellido')).toBe('')
  })

  it('rejects names with symbols or numbers', () => {
    expect(validatePersonName('Charles:#', 'El nombre')).toBe(
      'El nombre solo debe contener letras y espacios',
    )
    expect(validatePersonName('Rojas2', 'El apellido')).toBe(
      'El apellido solo debe contener letras y espacios',
    )
  })

  it('allows phone numbers with numbers, spaces and an optional plus sign', () => {
    expect(validatePhone('+591 70012345')).toBe('')
    expect(validatePhone('700 123 45')).toBe('')
  })

  it('rejects phone numbers with invalid characters', () => {
    expect(validatePhone('764544_df')).toBe(
      'El telefono solo debe contener numeros, espacios o +',
    )
  })

  it('allows empty optional email', () => {
    expect(validateOptionalEmail('')).toBe('')
  })

  it('validates optional email when it has a value', () => {
    expect(validateOptionalEmail('paciente@dayia.com')).toBe('')
    expect(validateOptionalEmail('correo-invalido')).toBe(
      'El email debe tener un formato valido',
    )
  })

  it('returns patient form errors for invalid formats', () => {
    expect(
      validatePatientForm({
        firstName: 'Charles:#',
        lastName: 'Rojas',
        phone: '764544_df',
        email: 'correo-invalido',
        birthDate: '',
      }),
    ).toEqual({
      firstName: 'El nombre solo debe contener letras y espacios',
      phone: 'El telefono solo debe contener numeros, espacios o +',
      email: 'El email debe tener un formato valido',
    })
  })

  it('detects when a patient form has errors', () => {
    expect(hasPatientFormErrors({ firstName: 'El nombre es requerido' })).toBe(
      true,
    )
    expect(hasPatientFormErrors({})).toBe(false)
  })
})
