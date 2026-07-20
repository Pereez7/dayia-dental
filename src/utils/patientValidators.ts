import type {
  Patient,
  PatientFormErrors,
  PatientFormValues,
} from '../types/Patient'
import { normalizePatientSearchText } from './patientFilters'

const namePattern = /^[\p{L}\s]+$/u
const countryCodePattern = /^\+\d{1,4}$/
const localPhonePattern = /^[\d\s]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const maxPatientAge = 120
const minPhoneLength = 6

export function validateRequired(value: string, message: string) {
  return value.trim() === '' ? message : ''
}

export function validatePersonName(value: string, fieldLabel: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return `${fieldLabel} es requerido`
  }

  if (!namePattern.test(trimmedValue)) {
    return `${fieldLabel} solo debe contener letras y espacios`
  }

  return ''
}

export function validateCountryCode(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return 'El prefijo de país es requerido'
  }

  if (!countryCodePattern.test(trimmedValue)) {
    return 'Usa + seguido de 1 a 4 dígitos'
  }

  return ''
}

export function validateLocalPhone(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return 'El número local es requerido'
  }

  if (!localPhonePattern.test(trimmedValue)) {
    return 'El número local solo debe contener dígitos'
  }

  if (trimmedValue.replace(/\D/g, '').length < minPhoneLength) {
    return 'El número local debe tener más de 5 dígitos'
  }

  return ''
}

export function validateOptionalEmail(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return ''
  }

  if (!emailPattern.test(trimmedValue)) {
    return 'Ingresa un correo válido.'
  }

  return ''
}

export function validateOptionalBirthDate(
  value: string,
  referenceDate = new Date(),
) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return ''
  }

  const birthDate = new Date(`${trimmedValue}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const oldestAllowedBirthDate = new Date(today)
  oldestAllowedBirthDate.setFullYear(today.getFullYear() - maxPatientAge)

  if (birthDate > today) {
    return 'La fecha de nacimiento no puede ser futura'
  }

  if (birthDate < oldestAllowedBirthDate) {
    return 'La edad no puede ser mayor a 120 años'
  }

  return ''
}

export function validatePatientForm(
  values: PatientFormValues,
  referenceDate = new Date(),
) {
  const errors: PatientFormErrors = {}

  const firstNameError = validatePersonName(values.firstName, 'El nombre')
  const lastNameError = validatePersonName(values.lastName, 'El apellido')
  const countryCodeError = validateCountryCode(values.countryCode)
  const localPhoneError = validateLocalPhone(values.localPhone)
  const emailError = validateOptionalEmail(values.email)
  const birthDateError = validateOptionalBirthDate(
    values.birthDate,
    referenceDate,
  )

  if (firstNameError) {
    errors.firstName = firstNameError
  }

  if (lastNameError) {
    errors.lastName = lastNameError
  }

  if (countryCodeError) {
    errors.countryCode = countryCodeError
  }

  if (localPhoneError) {
    errors.localPhone = localPhoneError
  }

  if (emailError) {
    errors.email = emailError
  }

  if (birthDateError) {
    errors.birthDate = birthDateError
  }

  return errors
}

export function hasPatientFormErrors(errors: PatientFormErrors) {
  return Object.keys(errors).length > 0
}

export function findDuplicatePatient(
  patients: Patient[],
  values: PatientFormValues,
  excludedPatientId?: Patient['id'],
) {
  const candidatePhone = normalizePhone(
    `${values.countryCode}${values.localPhone}`,
  )
  const candidateName = normalizePatientSearchText(
    `${values.firstName} ${values.lastName}`,
  )

  return patients.find((patient) => {
    if (patient.id === excludedPatientId || patient.status === 'inactive') {
      return false
    }

    const hasSamePhone = normalizePhone(patient.phone) === candidatePhone
    const hasSameIdentity =
      normalizePatientSearchText(patient.fullName) === candidateName &&
      hasSamePhone

    return hasSamePhone || hasSameIdentity
  })
}

export function getDuplicatePatientMessage(
  patients: Patient[],
  values: PatientFormValues,
  excludedPatientId?: Patient['id'],
) {
  const candidatePhone = normalizePhone(
    `${values.countryCode}${values.localPhone}`,
  )
  const candidateEmail = values.email.trim().toLocaleLowerCase('es-BO')
  const activePatients = patients.filter(
    (patient) =>
      patient.id !== excludedPatientId && patient.status !== 'inactive',
  )

  if (
    activePatients.some(
      (patient) => normalizePhone(patient.phone) === candidatePhone,
    )
  ) {
    return 'El teléfono ya está registrado en otro paciente.'
  }

  if (
    candidateEmail &&
    activePatients.some(
      (patient) =>
        patient.email?.trim().toLocaleLowerCase('es-BO') === candidateEmail,
    )
  ) {
    return 'El correo ya está registrado en otro paciente.'
  }

  return ''
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}
