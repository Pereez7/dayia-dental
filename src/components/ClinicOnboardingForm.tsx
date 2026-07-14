import { useRef, useState, type FormEvent } from 'react'

import type {
  ClinicOnboardingFormErrors,
  ClinicOnboardingFormValues,
} from '../types/ClinicOnboarding'
import type { PlanId } from '../utils/planFeatures'
import type {
  CreatePlatformClinicInput,
  CreatePlatformClinicResponse,
} from '../types/platform'
import {
  hasClinicOnboardingErrors,
  validateClinicOnboardingForm,
} from '../utils/clinicOnboarding'
import { submitPlatformClinicOnce } from '../utils/platformClinicCreation'

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

interface ClinicOnboardingFormProps {
  onCreate: (
    input: CreatePlatformClinicInput,
  ) => Promise<{ data: CreatePlatformClinicResponse | null; error: string | null }>
}

interface ClinicOnboardingFeedbackProps {
  errorMessage: string
  successMessage: string
}

export function ClinicOnboardingForm({
  onCreate,
}: ClinicOnboardingFormProps) {
  const [formValues, setFormValues] =
    useState<ClinicOnboardingFormValues>(initialValues)
  const [fieldErrors, setFieldErrors] =
    useState<ClinicOnboardingFormErrors>({})
  const [validationMessage, setValidationMessage] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionLock = useRef(false)

  function updateField<Field extends keyof ClinicOnboardingFormValues>(
    field: Field,
    value: ClinicOnboardingFormValues[Field],
  ) {
    const nextValues = { ...formValues, [field]: value }
    setFormValues(nextValues)
    setValidationMessage('')
    setSubmissionError('')

    if (fieldErrors[field]) {
      setFieldErrors(validateClinicOnboardingForm(nextValues))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    const errors = validateClinicOnboardingForm(formValues)
    setFieldErrors(errors)

    if (hasClinicOnboardingErrors(errors)) {
      setValidationMessage('')
      setSubmissionError('')
      return
    }

    setIsSubmitting(true)
    setSubmissionError('')
    setValidationMessage('')

    let result: Awaited<ReturnType<typeof submitPlatformClinicOnce>>

    try {
      result = await submitPlatformClinicOnce(
        {
          clinicName: formValues.clinicName,
          ownerEmail: formValues.ownerEmail,
          ownerName: formValues.ownerName,
          planId: formValues.initialPlan,
        },
        submissionLock,
        onCreate,
      )
    } catch {
      setIsSubmitting(false)
      setSubmissionError(
        'No pudimos preparar el consultorio. Intenta nuevamente.',
      )
      return
    }

    setIsSubmitting(false)

    if (!result) {
      return
    }

    if (result.error || !result.data) {
      setSubmissionError(result.error ?? 'No pudimos preparar el consultorio.')
      return
    }

    setFormValues(initialValues)
    setValidationMessage(
      'Consultorio preparado correctamente.',
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
          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? 'Preparando consultorio…'
              : 'Preparar consultorio'}
          </button>
          <ClinicOnboardingFeedback
            errorMessage={submissionError}
            successMessage={validationMessage}
          />
        </div>
      </form>
    </section>
  )
}

export function ClinicOnboardingFeedback({
  errorMessage,
  successMessage,
}: ClinicOnboardingFeedbackProps) {
  if (successMessage) {
    return (
      <p
        className="field-message field-message--success clinic-onboarding-result"
        role="status"
      >
        {successMessage}
      </p>
    )
  }

  return (
    <>
      <p className="clinic-onboarding-help">
        {errorMessage ===
        'La creación real de consultorios está deshabilitada.'
          ? 'La creación real sigue deshabilitada.'
          : 'Revisa los datos antes de preparar el consultorio.'}
      </p>
      {errorMessage && (
        <p
          className="field-message field-message--error clinic-onboarding-result"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </>
  )
}
