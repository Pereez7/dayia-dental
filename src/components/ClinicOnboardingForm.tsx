import { useRef, useState, type FormEvent } from 'react'

import type {
  ClinicOnboardingFormErrors,
  ClinicOnboardingPriceTier,
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
  initialPriceTier: 'standard',
  ownerEmail: '',
  ownerName: '',
}

const planOptions: { description: string; label: string; value: PlanId }[] = [
  { description: 'Plan esencial', label: 'Basic', value: 'basic' },
  { description: 'Plan intermedio', label: 'Medium', value: 'medium' },
  { description: 'Plan completo', label: 'Pro', value: 'pro' },
]

const priceTierOptions: {
  description: string
  label: string
  value: ClinicOnboardingPriceTier
}[] = [
  {
    description: 'Usa el precio mensual regular del plan.',
    label: 'Tarifa estándar',
    value: 'standard',
  },
  {
    description: 'Aplica el precio fundador mensual configurado.',
    label: 'Tarifa fundador',
    value: 'founder',
  },
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
          priceTier: formValues.initialPriceTier,
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

        </div>

        <section className="clinic-onboarding-commercial" aria-labelledby="clinic-commercial-title">
          <div className="clinic-onboarding-section-heading">
            <div>
              <h3 id="clinic-commercial-title">Configuración comercial</h3>
              <p>Define el plan y la tarifa que tendrá el consultorio al terminar la prueba.</p>
            </div>
            <div className="clinic-onboarding-trial">
              <span>Acceso inicial</span>
              <strong>15 días de prueba</strong>
              <small>Luego, 5 días de gracia</small>
            </div>
          </div>

          <fieldset className="clinic-onboarding-choice-group">
            <legend>Plan inicial</legend>
            <div
              aria-describedby={fieldErrors.initialPlan ? 'clinic-plan-error' : undefined}
              className="clinic-onboarding-plan-options"
              role="radiogroup"
            >
              {planOptions.map((option) => {
                const isSelected = formValues.initialPlan === option.value

                return (
                  <button
                    aria-checked={isSelected}
                    className={`clinic-onboarding-choice${isSelected ? ' clinic-onboarding-choice--selected' : ''}`}
                    key={option.value}
                    onClick={() => updateField('initialPlan', option.value)}
                    role="radio"
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                )
              })}
            </div>
            {fieldErrors.initialPlan ? (
              <small className="field-message field-message--error" id="clinic-plan-error">
                {fieldErrors.initialPlan}
              </small>
            ) : null}
          </fieldset>

          <fieldset className="clinic-onboarding-choice-group">
            <legend>Tarifa inicial</legend>
            <div
              aria-describedby={fieldErrors.initialPriceTier ? 'clinic-price-tier-error' : undefined}
              className="clinic-onboarding-tier-options"
              role="radiogroup"
            >
              {priceTierOptions.map((option) => {
                const isSelected = formValues.initialPriceTier === option.value

                return (
                  <button
                    aria-checked={isSelected}
                    className={`clinic-onboarding-choice${isSelected ? ' clinic-onboarding-choice--selected' : ''}`}
                    key={option.value}
                    onClick={() => updateField('initialPriceTier', option.value)}
                    role="radio"
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                )
              })}
            </div>
            {fieldErrors.initialPriceTier ? (
              <small className="field-message field-message--error" id="clinic-price-tier-error">
                {fieldErrors.initialPriceTier}
              </small>
            ) : null}
          </fieldset>

          <dl className="clinic-onboarding-summary" aria-live="polite">
            <div><dt>Prueba</dt><dd>15 días</dd></div>
            <div><dt>Plan</dt><dd>{getPlanLabel(formValues.initialPlan)}</dd></div>
            <div><dt>Tarifa</dt><dd>{formValues.initialPriceTier === 'founder' ? 'Fundador' : 'Estándar'}</dd></div>
            <div><dt>Activación</dt><dd>Al aceptar la invitación</dd></div>
          </dl>
        </section>

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

function getPlanLabel(planId: PlanId) {
  return planOptions.find((option) => option.value === planId)?.label ?? 'Basic'
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
