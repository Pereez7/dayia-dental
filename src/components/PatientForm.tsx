import { useState, type FormEvent } from 'react'
import type { PatientFormErrors, PatientFormValues } from '../types/Patient'
import {
  hasPatientFormErrors,
  validatePatientForm,
} from '../utils/patientValidators'

const initialFormValues: PatientFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
}

interface PatientFormProps {
  onCreatePatient: (values: PatientFormValues) => void
}

export function PatientForm({ onCreatePatient }: PatientFormProps) {
  const [formValues, setFormValues] =
    useState<PatientFormValues>(initialFormValues)
  const [errors, setErrors] = useState<PatientFormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')

  function updateField(field: keyof PatientFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validatePatientForm(formValues)
    setErrors(validationErrors)

    if (hasPatientFormErrors(validationErrors)) {
      return
    }

    onCreatePatient(formValues)
    setFormValues(initialFormValues)
    setErrors({})
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
            value={formValues.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
          {errors.firstName && <small>{errors.firstName}</small>}
        </label>

        <label>
          <span>Apellido</span>
          <input
            type="text"
            value={formValues.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
          {errors.lastName && <small>{errors.lastName}</small>}
        </label>

        <label>
          <span>Telefono</span>
          <input
            type="tel"
            value={formValues.phone}
            onChange={(event) => updateField('phone', event.target.value)}
          />
          {errors.phone && <small>{errors.phone}</small>}
        </label>

        <label>
          <span>Email opcional</span>
          <input
            type="email"
            value={formValues.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </label>

        <label>
          <span>Fecha de nacimiento opcional</span>
          <input
            type="date"
            value={formValues.birthDate}
            onChange={(event) => updateField('birthDate', event.target.value)}
          />
        </label>

        <button className="primary-action" type="submit">
          Registrar paciente
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
