import type { PatientFormErrors, PatientFormValues } from '../types/Patient'

const namePattern = /^[\p{L}\s]+$/u
const phonePattern = /^\+?[\d\s]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const maxPatientAge = 120

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

export function validatePhone(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return 'El telefono es requerido'
  }

  if (!phonePattern.test(trimmedValue)) {
    return 'El telefono solo debe contener numeros, espacios o +'
  }

  return ''
}

export function validateOptionalEmail(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return ''
  }

  if (!emailPattern.test(trimmedValue)) {
    return 'El email debe tener un formato valido'
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
  const phoneError = validatePhone(values.phone)
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

  if (phoneError) {
    errors.phone = phoneError
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
