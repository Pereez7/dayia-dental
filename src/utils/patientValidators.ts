import type { PatientFormErrors, PatientFormValues } from '../types/Patient'

const namePattern = /^[\p{L}\s]+$/u
const phonePattern = /^\+?[\d\s]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export function validatePatientForm(values: PatientFormValues) {
  const errors: PatientFormErrors = {}

  const firstNameError = validatePersonName(values.firstName, 'El nombre')
  const lastNameError = validatePersonName(values.lastName, 'El apellido')
  const phoneError = validatePhone(values.phone)
  const emailError = validateOptionalEmail(values.email)

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

  return errors
}

export function hasPatientFormErrors(errors: PatientFormErrors) {
  return Object.keys(errors).length > 0
}
