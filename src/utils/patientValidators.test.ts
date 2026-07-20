import { describe, expect, it } from 'vitest'
import type { PatientFormValues } from '../types/Patient'
import {
  findDuplicatePatient,
  getDuplicatePatientMessage,
  hasPatientFormErrors,
  validateCountryCode,
  validateLocalPhone,
  validateOptionalBirthDate,
  validateOptionalEmail,
  validatePatientForm,
  validatePersonName,
  validateRequired,
} from './patientValidators'
import type { Patient } from '../types/Patient'

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
      countryCode: 'El prefijo de país es requerido',
      localPhone: 'El número local es requerido',
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
      'Usa + seguido de 1 a 4 dígitos',
    )
    expect(validateCountryCode('+BO')).toBe(
      'Usa + seguido de 1 a 4 dígitos',
    )
    expect(validateCountryCode('+12345')).toBe(
      'Usa + seguido de 1 a 4 dígitos',
    )
  })

  it('allows local phone numbers with digits only', () => {
    expect(validateLocalPhone('70012345')).toBe('')
    expect(validateLocalPhone('700 123 45')).toBe('')
  })

  it('rejects local phone numbers with letters or symbols', () => {
    expect(validateLocalPhone('764544_df')).toBe(
      'El número local solo debe contener dígitos',
    )
  })

  it('rejects local phone numbers with fewer than 6 digits', () => {
    expect(validateLocalPhone('12345')).toBe(
      'El número local debe tener más de 5 dígitos',
    )
  })

  it('allows empty optional email', () => {
    expect(validateOptionalEmail('')).toBe('')
  })

  it('validates optional email when it has a value', () => {
    expect(validateOptionalEmail('paciente@dayia.com')).toBe('')
    expect(validateOptionalEmail('correo-invalido')).toBe(
      'Ingresa un correo válido.',
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
      countryCode: 'Usa + seguido de 1 a 4 dígitos',
      localPhone: 'El número local solo debe contener dígitos',
      email: 'Ingresa un correo válido.',
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
      localPhone: 'El número local debe tener más de 5 dígitos',
    })
  })

  it('detects when a patient form has errors', () => {
    expect(hasPatientFormErrors({ firstName: 'El nombre es requerido' })).toBe(
      true,
    )
    expect(hasPatientFormErrors({})).toBe(false)
  })

  it('detects an existing patient by normalized phone', () => {
    const patients: Patient[] = [
      {
        id: 'patient-1',
        fullName: 'Lucía Vargas',
        phone: '+591 70000000',
        lastVisit: 'Sin registro',
        nextAppointment: null,
        status: 'active',
      },
    ]

    expect(findDuplicatePatient(patients, validFormValues)?.id).toBe(
      'patient-1',
    )
    expect(getDuplicatePatientMessage(patients, validFormValues)).toBe(
      'El teléfono ya está registrado en otro paciente.',
    )
  })

  it('allows a patient with a different phone', () => {
    expect(
      getDuplicatePatientMessage(
        [
          {
            id: 'patient-1',
            fullName: 'Lucia Vargas',
            phone: '+59171111111',
            lastVisit: 'Sin registro',
            nextAppointment: null,
            status: 'active',
          },
        ],
        validFormValues,
      ),
    ).toBe('')
  })

  it('ignores the current patient and inactive records when editing', () => {
    const patients: Patient[] = [
      {
        id: 'patient-1',
        fullName: 'Lucia Vargas',
        phone: '+59170000000',
        lastVisit: 'Sin registro',
        nextAppointment: null,
        status: 'active',
      },
      {
        id: 'patient-2',
        fullName: 'Paciente inactivo',
        phone: '+59170000000',
        lastVisit: 'Sin registro',
        nextAppointment: null,
        status: 'inactive',
      },
    ]

    expect(
      getDuplicatePatientMessage(patients, validFormValues, 'patient-1'),
    ).toBe('')
  })

  it('detects a duplicated active email case-insensitively', () => {
    expect(
      getDuplicatePatientMessage(
        [
          {
            id: 'patient-1',
            email: 'lucia@example.com',
            fullName: 'Lucia Vargas',
            phone: '+59171111111',
            lastVisit: 'Sin registro',
            nextAppointment: null,
            status: 'active',
          },
        ],
        { ...validFormValues, email: 'LUCIA@EXAMPLE.COM' },
      ),
    ).toBe('El correo ya está registrado en otro paciente.')
  })
})
