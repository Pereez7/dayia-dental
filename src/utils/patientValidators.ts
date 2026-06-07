import type { PatientFormErrors, PatientFormValues } from '../types/Patient'

export function validateRequired(value: string, message: string) {
  return value.trim() === '' ? message : ''
}

export function validatePatientForm(values: PatientFormValues) {
  const errors: PatientFormErrors = {}

  const firstNameError = validateRequired(
    values.firstName,
    'El nombre es requerido',
  )
  const lastNameError = validateRequired(
    values.lastName,
    'El apellido es requerido',
  )
  const phoneError = validateRequired(values.phone, 'El telefono es requerido')

  if (firstNameError) {
    errors.firstName = firstNameError
  }

  if (lastNameError) {
    errors.lastName = lastNameError
  }

  if (phoneError) {
    errors.phone = phoneError
  }

  return errors
}

export function hasPatientFormErrors(errors: PatientFormErrors) {
  return Object.keys(errors).length > 0
}
