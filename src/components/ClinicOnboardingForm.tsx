import { useState, type FormEvent } from 'react'

import type {
  ClinicOnboardingFormErrors,
  ClinicOnboardingFormValues,
} from '../types/ClinicOnboarding'
import type { PlanId } from '../utils/planFeatures'
import {
  hasClinicOnboardingErrors,
  validateClinicOnboardingForm,
} from '../utils/clinicOnboarding'

const initialValues: ClinicOnboardingFormValues = {
  clinicName: '',
  initialPlan: 'basic',
  ownerEmail: '',
  ownerName: '',
}

const planOptions: { label: string; value: PlanId }[] = [
  { label: 'Basic', value: 'basic' },
  { label: 'Medium', value: 'medium' },
  { label: 'Pro', value: 'pro' },
]

export function ClinicOnboardingForm() {
  const [formValues, setFormValues] =
    useState<ClinicOnboardingFormValues>(initialValues)
  const [fieldErrors, setFieldErrors] =
    useState<ClinicOnboardingFormErrors>({})
  const [validationMessage, setValidationMessage] = useState('')

  function updateField<Field extends keyof ClinicOnboardingFormValues>(
    field: Field,
    value: ClinicOnboardingFormValues[Field],
  ) {
    const nextValues = { ...formValues, [field]: value }
    setFormValues(nextValues)
    setValidationMessage('')

    if (fieldErrors[field]) {
      setFieldErrors(validateClinicOnboardingForm(nextValues))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors = validateClinicOnboardingForm(formValues)
    setFieldErrors(errors)

    if (hasClinicOnboardingErrors(errors)) {
      setValidationMessage('')
      return
    }

    setValidationMessage(
      'Los datos están completos y listos para el alta cuando se habilite la creación.',
    )
  }

  return (
    <section className="administration-panel" aria-labelledby="clinic-onboarding-title">
      <div className="administration-panel-header">
        <div>
          <h2 id="clinic-onboarding-title">Alta segura de consultorios</h2>
          <p>
            Revisa los datos del consultorio y de su propietario antes de
            habilitar una cuenta.
          </p>
        </div>
        <span className="validation-mode-badge">Modo de validación</span>
      </div>

      <form className="clinic-onboarding-form" noValidate onSubmit={handleSubmit}>
        <div className="clinic-onboarding-grid">
          <label className="clinic-onboarding-field">
            <span>Nombre del consultorio</span>
            <input
              aria-describedby={
                fieldErrors.clinicName ? 'clinic-name-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.clinicName)}
              autoComplete="organization"
              placeholder="Ej. Clínica Dental Norte"
              value={formValues.clinicName}
              onChange={(event) => updateField('clinicName', event.target.value)}
            />
            {fieldErrors.clinicName && (
              <small className="field-message field-message--error" id="clinic-name-error">
                {fieldErrors.clinicName}
              </small>
            )}
          </label>

          <label className="clinic-onboarding-field">
            <span>Doctor propietario</span>
            <input
              aria-describedby={
                fieldErrors.ownerName ? 'clinic-owner-name-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.ownerName)}
              autoComplete="name"
              placeholder="Ej. Dra. Andrea Pérez"
              value={formValues.ownerName}
              onChange={(event) => updateField('ownerName', event.target.value)}
            />
            {fieldErrors.ownerName && (
              <small
                className="field-message field-message--error"
                id="clinic-owner-name-error"
              >
                {fieldErrors.ownerName}
              </small>
            )}
          </label>

          <label className="clinic-onboarding-field">
            <span>Email del propietario</span>
            <input
              aria-describedby={
                fieldErrors.ownerEmail ? 'clinic-owner-email-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.ownerEmail)}
              autoComplete="email"
              inputMode="email"
              placeholder="doctora@consultorio.com"
              type="email"
              value={formValues.ownerEmail}
              onChange={(event) => updateField('ownerEmail', event.target.value)}
            />
            {fieldErrors.ownerEmail && (
              <small
                className="field-message field-message--error"
                id="clinic-owner-email-error"
              >
                {fieldErrors.ownerEmail}
              </small>
            )}
          </label>

          <label className="clinic-onboarding-field">
            <span>Plan inicial</span>
            <select
              aria-describedby={
                fieldErrors.initialPlan ? 'clinic-plan-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.initialPlan)}
              value={formValues.initialPlan}
              onChange={(event) =>
                updateField('initialPlan', event.target.value as PlanId)
              }
            >
              {planOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.initialPlan && (
              <small className="field-message field-message--error" id="clinic-plan-error">
                {fieldErrors.initialPlan}
              </small>
            )}
          </label>
        </div>

        <div className="clinic-onboarding-actions">
          <button className="primary-action" type="submit">
            Validar alta
          </button>
          <p className="clinic-onboarding-help">
            Validar alta revisa los datos sin crear consultorios.
          </p>
          {validationMessage && (
            <p
              className="field-message field-message--success clinic-onboarding-result"
              role="status"
            >
              {validationMessage}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
