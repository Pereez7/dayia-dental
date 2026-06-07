import { describe, expect, it } from 'vitest'
import type { PatientFormValues } from '../types/Patient'
import {
  hasPatientFormErrors,
  validateCountryCode,
  validateLocalPhone,
  validateOptionalBirthDate,
  validateOptionalEmail,
  validatePatientForm,
  validatePersonName,
  validateRequired,
} from './patientValidators'

const validFormValues: PatientFormValues = {
  firstName: 'Lucia',
  lastName: 'Vargas',
  countryCode: '+591',
  localPhone: '70000000',
  email: '',
  birthDate: '',
}

const referenceDate = new Date('2026-06-07T00:00:00')

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
        countryCode: '',
        localPhone: '',
        email: '',
        birthDate: '',
      }),
    ).toEqual({
      firstName: 'El nombre es requerido',
      lastName: 'El apellido es requerido',
      countryCode: 'El prefijo de pais es requerido',
      localPhone: 'El numero local es requerido',
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

  it('allows country codes that start with plus and contain digits', () => {
    expect(validateCountryCode('+591')).toBe('')
  })

  it('rejects invalid country codes', () => {
    expect(validateCountryCode('591')).toBe(
      'El prefijo debe iniciar con + y contener solo numeros',
    )
    expect(validateCountryCode('+BO')).toBe(
      'El prefijo debe iniciar con + y contener solo numeros',
    )
  })

  it('allows local phone numbers with digits only', () => {
    expect(validateLocalPhone('70012345')).toBe('')
  })

  it('rejects local phone numbers with letters or symbols', () => {
    expect(validateLocalPhone('764544_df')).toBe(
      'El numero local solo debe contener digitos',
    )
  })

  it('rejects local phone numbers with fewer than 6 digits', () => {
    expect(validateLocalPhone('12345')).toBe(
      'El numero local debe tener mas de 5 digitos',
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

  it('allows empty optional birth date', () => {
    expect(validateOptionalBirthDate('', referenceDate)).toBe('')
  })

  it('allows a valid birth date', () => {
    expect(validateOptionalBirthDate('1995-04-12', referenceDate)).toBe('')
  })

  it('rejects a future birth date', () => {
    expect(validateOptionalBirthDate('2026-06-08', referenceDate)).toBe(
      'La fecha de nacimiento no puede ser futura',
    )
  })

  it('rejects a birth date older than 120 years', () => {
    expect(validateOptionalBirthDate('1906-06-06', referenceDate)).toBe(
      'La edad no puede ser mayor a 120 años',
    )
  })

  it('returns patient form errors for invalid formats', () => {
    expect(
      validatePatientForm(
        {
          firstName: 'Charles:#',
          lastName: 'Rojas',
          countryCode: '591',
          localPhone: '764544_df',
          email: 'correo-invalido',
          birthDate: '2026-06-08',
        },
        referenceDate,
      ),
    ).toEqual({
      firstName: 'El nombre solo debe contener letras y espacios',
      countryCode: 'El prefijo debe iniciar con + y contener solo numeros',
      localPhone: 'El numero local solo debe contener digitos',
      email: 'El email debe tener un formato valido',
      birthDate: 'La fecha de nacimiento no puede ser futura',
    })
  })

  it('returns patient form error for short phone numbers', () => {
    expect(
      validatePatientForm({
        firstName: 'Lucia',
        lastName: 'Vargas',
        countryCode: '+591',
        localPhone: '12345',
        email: '',
        birthDate: '',
      }),
    ).toEqual({
      localPhone: 'El numero local debe tener mas de 5 digitos',
    })
  })

  it('detects when a patient form has errors', () => {
    expect(hasPatientFormErrors({ firstName: 'El nombre es requerido' })).toBe(
      true,
    )
    expect(hasPatientFormErrors({})).toBe(false)
  })
})
