import { useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  Patient,
  PatientFormErrors,
  PatientFormValues,
} from '../types/Patient'
import {
  hasPatientFormErrors,
  validatePatientForm,
} from '../utils/patientValidators'
import { Toast } from './Toast'

const initialFormValues: PatientFormValues = {
  firstName: '',
  lastName: '',
  countryCode: '+591',
  localPhone: '',
  email: '',
  birthDate: '',
}

const countryCodeOptions = [
  { country: 'Bolivia', code: '+591' },
  { country: 'Argentina', code: '+54' },
  { country: 'Brasil', code: '+55' },
  { country: 'Chile', code: '+56' },
  { country: 'Peru', code: '+51' },
  { country: 'Paraguay', code: '+595' },
]

interface PatientFormProps {
  onCreatePatient: (
    values: PatientFormValues,
  ) => Promise<{
    error?: string
    patientId?: Patient['id']
    success: boolean
  }>
}

export function PatientForm({ onCreatePatient }: PatientFormProps) {
  const submissionLock = useRef(false)
  const [formValues, setFormValues] =
    useState<PatientFormValues>(initialFormValues)
  const [errors, setErrors] = useState<PatientFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(''), 3200)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  function updateField(field: keyof PatientFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    const validationErrors = validatePatientForm(formValues)
    setErrors(validationErrors)

    if (hasPatientFormErrors(validationErrors)) {
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)

    let result: Awaited<ReturnType<typeof onCreatePatient>>

    try {
      result = await onCreatePatient(formValues)
    } catch {
      result = {
        error: 'No pudimos registrar el paciente. Intenta nuevamente.',
        success: false,
      }
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }

    if (!result.success) {
      setSubmitError(result.error ?? 'No pudimos registrar el paciente.')
      setSuccessMessage('')
      return
    }

    setFormValues(initialFormValues)
    setErrors({})
    setSubmitError('')
    setSuccessMessage('Paciente registrado correctamente.')
  }

  return (
    <section className="patient-form-section" aria-labelledby="patient-form-title">
      <div className="section-heading">
        <p className="eyebrow">Registro</p>
        <h2 id="patient-form-title">Nuevo paciente</h2>
        <p className="section-description">
          Completa los datos de contacto para crear su ficha.
        </p>
      </div>

      <form className="patient-form" onSubmit={handleSubmit}>
        <label>
          <span>Nombre</span>
          <input
            id="patient-first-name"
            aria-describedby={
              errors.firstName ? 'patient-first-name-error' : undefined
            }
            aria-invalid={Boolean(errors.firstName)}
            autoComplete="given-name"
            type="text"
            placeholder="Ej. Charles"
            value={formValues.firstName}
            disabled={isSubmitting}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
          {errors.firstName && (
            <small id="patient-first-name-error">{errors.firstName}</small>
          )}
        </label>

        <label>
          <span>Apellido</span>
          <input
            aria-describedby={
              errors.lastName ? 'patient-last-name-error' : undefined
            }
            aria-invalid={Boolean(errors.lastName)}
            autoComplete="family-name"
            type="text"
            placeholder="Ej. Pérez"
            value={formValues.lastName}
            disabled={isSubmitting}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
          {errors.lastName && (
            <small id="patient-last-name-error">{errors.lastName}</small>
          )}
        </label>

        <fieldset className="phone-field">
          <legend>Teléfono</legend>
          <div className="phone-control">
            <select
              aria-label="Prefijo de país"
              value={formValues.countryCode}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('countryCode', event.target.value)
              }
            >
              {countryCodeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code}
                </option>
              ))}
            </select>

            <input
              aria-describedby={
                errors.localPhone ? 'patient-phone-error' : undefined
              }
              aria-invalid={Boolean(errors.localPhone)}
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              aria-label="Número local"
              placeholder="70000000"
              value={formValues.localPhone}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('localPhone', event.target.value)
              }
            />
          </div>
          {errors.countryCode && <small>{errors.countryCode}</small>}
          {errors.localPhone && (
            <small id="patient-phone-error">{errors.localPhone}</small>
          )}
        </fieldset>

        <label>
          <span>Email opcional</span>
          <input
            aria-describedby={errors.email ? 'patient-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            type="email"
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            value={formValues.email}
            disabled={isSubmitting}
            onChange={(event) => updateField('email', event.target.value)}
          />
          {errors.email && (
            <small id="patient-email-error">{errors.email}</small>
          )}
        </label>

        <label>
          <span>Fecha de nacimiento opcional</span>
          <input
            aria-describedby={
              errors.birthDate ? 'patient-birth-date-error' : undefined
            }
            aria-invalid={Boolean(errors.birthDate)}
            type="date"
            value={formValues.birthDate}
            disabled={isSubmitting}
            onChange={(event) => updateField('birthDate', event.target.value)}
          />
          {errors.birthDate && (
            <small id="patient-birth-date-error">{errors.birthDate}</small>
          )}
        </label>

        {submitError && (
          <p className="field-message field-message--error" role="alert">
            {submitError}
          </p>
        )}

        <button className="primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Registrando...' : 'Registrar paciente'}
        </button>
      </form>

      <Toast
        message={successMessage}
        tone="success"
        visible={Boolean(successMessage)}
      />
    </section>
  )
}
