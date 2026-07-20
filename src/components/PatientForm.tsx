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
import { PatientFields } from './PatientFields'
import { Toast } from './Toast'

const initialFormValues: PatientFormValues = {
  firstName: '',
  lastName: '',
  countryCode: '+591',
  localPhone: '',
  email: '',
  birthDate: '',
}

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
        <PatientFields
          disabled={isSubmitting}
          errors={errors}
          idPrefix="patient"
          values={formValues}
          onChange={updateField}
        />

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
