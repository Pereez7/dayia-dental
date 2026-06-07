import type { PatientFormErrors, PatientFormValues } from '../types/Patient'

const namePattern = /^[\p{L}\s]+$/u
const countryCodePattern = /^\+\d+$/
const localPhonePattern = /^\d+$/
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
    return 'El prefijo de pais es requerido'
  }

  if (!countryCodePattern.test(trimmedValue)) {
    return 'El prefijo debe iniciar con + y contener solo numeros'
  }

  return ''
}

export function validateLocalPhone(value: string) {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return 'El numero local es requerido'
  }

  if (!localPhonePattern.test(trimmedValue)) {
    return 'El numero local solo debe contener digitos'
  }

  if (trimmedValue.length < minPhoneLength) {
    return 'El numero local debe tener mas de 5 digitos'
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
