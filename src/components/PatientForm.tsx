import { useState, type FormEvent } from 'react'
import type { PatientFormErrors, PatientFormValues } from '../types/Patient'
import {
  hasPatientFormErrors,
  validatePatientForm,
} from '../utils/patientValidators'

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
  ) => Promise<{ error?: string; success: boolean }>
}

export function PatientForm({ onCreatePatient }: PatientFormProps) {
  const [formValues, setFormValues] =
    useState<PatientFormValues>(initialFormValues)
  const [errors, setErrors] = useState<PatientFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof PatientFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validatePatientForm(formValues)
    setErrors(validationErrors)

    if (hasPatientFormErrors(validationErrors)) {
      return
    }

    setIsSubmitting(true)
    const result = await onCreatePatient(formValues)
    setIsSubmitting(false)

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
      </div>

      <form className="patient-form" onSubmit={handleSubmit}>
        <label>
          <span>Nombre</span>
          <input
            type="text"
            placeholder="Ej. Charles"
            value={formValues.firstName}
            disabled={isSubmitting}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
          {errors.firstName && <small>{errors.firstName}</small>}
        </label>

        <label>
          <span>Apellido</span>
          <input
            type="text"
            placeholder="Ej. Pérez"
            value={formValues.lastName}
            disabled={isSubmitting}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
          {errors.lastName && <small>{errors.lastName}</small>}
        </label>

        <fieldset className="phone-field">
          <legend>Telefono</legend>
          <div className="phone-control">
            <select
              aria-label="Prefijo de pais"
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
              type="tel"
              inputMode="numeric"
              aria-label="Numero local"
              placeholder="70000000"
              value={formValues.localPhone}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('localPhone', event.target.value)
              }
            />
          </div>
          {errors.countryCode && <small>{errors.countryCode}</small>}
          {errors.localPhone && <small>{errors.localPhone}</small>}
        </fieldset>

        <label>
          <span>Email opcional</span>
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={formValues.email}
            disabled={isSubmitting}
            onChange={(event) => updateField('email', event.target.value)}
          />
          {errors.email && <small>{errors.email}</small>}
        </label>

        <label>
          <span>Fecha de nacimiento opcional</span>
          <input
            type="date"
            value={formValues.birthDate}
            disabled={isSubmitting}
            onChange={(event) => updateField('birthDate', event.target.value)}
          />
          {errors.birthDate && <small>{errors.birthDate}</small>}
        </label>

        {submitError && (
          <p className="field-message field-message--error">{submitError}</p>
        )}

        <button className="primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Registrando...' : 'Registrar paciente'}
        </button>
      </form>

      {successMessage && (
        <p className="success-message" role="status">
          {successMessage}
        </p>
      )}
    </section>
  )
}
