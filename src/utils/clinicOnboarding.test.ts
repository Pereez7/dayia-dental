import { describe, expect, it } from 'vitest'

import type { ClinicOnboardingFormValues } from '../types/ClinicOnboarding'
import {
  hasClinicOnboardingErrors,
  validateClinicOnboardingForm,
} from './clinicOnboarding'

const validValues: ClinicOnboardingFormValues = {
  clinicName: 'Clínica Dental Norte',
  initialPlan: 'basic',
  ownerEmail: 'doctora@clinicanorte.com',
  ownerName: 'Dra. Andrea Pérez',
}

describe('validateClinicOnboardingForm', () => {
  it('accepts complete onboarding data', () => {
    expect(validateClinicOnboardingForm(validValues)).toEqual({})
  })

  it('returns clear inline errors for empty fields', () => {
    expect(
      validateClinicOnboardingForm({
        clinicName: ' ',
        initialPlan: 'unknown' as ClinicOnboardingFormValues['initialPlan'],
        ownerEmail: '',
        ownerName: '',
      }),
    ).toEqual({
      clinicName: 'Ingresa el nombre del consultorio.',
      initialPlan: 'Selecciona un plan inicial válido.',
      ownerEmail: 'Ingresa el email del propietario.',
      ownerName: 'Ingresa el nombre del doctor propietario.',
    })
  })

  it('rejects an invalid owner email', () => {
    expect(
      validateClinicOnboardingForm({
        ...validValues,
        ownerEmail: 'correo-invalido',
      }).ownerEmail,
    ).toBe('Ingresa un email válido.')
  })
})

describe('hasClinicOnboardingErrors', () => {
  it('detects whether validation returned errors', () => {
    expect(hasClinicOnboardingErrors({})).toBe(false)
    expect(
      hasClinicOnboardingErrors({ clinicName: 'Campo requerido.' }),
    ).toBe(true)
  })
})
