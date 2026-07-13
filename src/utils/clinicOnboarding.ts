import type {
  ClinicOnboardingFormErrors,
  ClinicOnboardingFormValues,
} from '../types/ClinicOnboarding'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validPlans = new Set(['basic', 'medium', 'pro'])

export function validateClinicOnboardingForm(
  values: ClinicOnboardingFormValues,
) {
  const errors: ClinicOnboardingFormErrors = {}

  if (!values.clinicName.trim()) {
    errors.clinicName = 'Ingresa el nombre del consultorio.'
  }

  if (!values.ownerName.trim()) {
    errors.ownerName = 'Ingresa el nombre del doctor propietario.'
  }

  const ownerEmail = values.ownerEmail.trim()

  if (!ownerEmail) {
    errors.ownerEmail = 'Ingresa el email del propietario.'
  } else if (!emailPattern.test(ownerEmail)) {
    errors.ownerEmail = 'Ingresa un email válido.'
  }

  if (!validPlans.has(values.initialPlan)) {
    errors.initialPlan = 'Selecciona un plan inicial válido.'
  }

  return errors
}

export function hasClinicOnboardingErrors(
  errors: ClinicOnboardingFormErrors,
) {
  return Object.keys(errors).length > 0
}
