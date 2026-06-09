import { useState, type FormEvent } from 'react'
import type {
  ClinicalRecordFormErrors,
  ClinicalRecordFormValues,
} from '../types/ClinicalRecord'
import {
  hasClinicalRecordFormErrors,
  normalizeClinicalRecordFormValues,
  validateClinicalRecordForm,
} from '../utils/clinicalRecords'

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getInitialFormValues(): ClinicalRecordFormValues {
  return {
    date: getTodayDateInputValue(),
    reason: '',
    diagnosis: '',
    treatment: '',
    notes: '',
  }
}

interface ClinicalRecordFormProps {
  onCreateRecord: (values: ClinicalRecordFormValues) => void
}

export function ClinicalRecordForm({
  onCreateRecord,
}: ClinicalRecordFormProps) {
  const [formValues, setFormValues] =
    useState<ClinicalRecordFormValues>(getInitialFormValues)
  const [errors, setErrors] = useState<ClinicalRecordFormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const maxRecordDate = getTodayDateInputValue()

  function updateField(field: keyof ClinicalRecordFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateClinicalRecordForm(formValues)
    setErrors(validationErrors)

    if (hasClinicalRecordFormErrors(validationErrors)) {
      return
    }

    onCreateRecord(normalizeClinicalRecordFormValues(formValues))
    setFormValues(getInitialFormValues())
    setErrors({})
    setSuccessMessage('Registro clínico agregado correctamente.')
  }

  return (
    <form className="clinical-record-form" onSubmit={handleSubmit}>
      <div className="clinical-form-grid">
        <label>
          <span>Fecha</span>
          <input
            type="date"
            max={maxRecordDate}
            value={formValues.date}
            onChange={(event) => updateField('date', event.target.value)}
          />
          {errors.date && (
            <small className="field-message field-message--error">
              {errors.date}
            </small>
          )}
        </label>

        <label>
          <span>Motivo de consulta</span>
          <input
            type="text"
            value={formValues.reason}
            onChange={(event) => updateField('reason', event.target.value)}
            placeholder="Ej. Dolor en molar inferior"
          />
          {errors.reason && (
            <small className="field-message field-message--error">
              {errors.reason}
            </small>
          )}
        </label>

        <label>
          <span>Diagnostico</span>
          <input
            type="text"
            value={formValues.diagnosis}
            onChange={(event) => updateField('diagnosis', event.target.value)}
            placeholder="Ej. Caries activa"
          />
          {errors.diagnosis && (
            <small className="field-message field-message--error">
              {errors.diagnosis}
            </small>
          )}
        </label>

        <label>
          <span>Tratamiento</span>
          <input
            type="text"
            value={formValues.treatment}
            onChange={(event) => updateField('treatment', event.target.value)}
            placeholder="Ej. Curacion dental"
          />
          {errors.treatment && (
            <small className="field-message field-message--error">
              {errors.treatment}
            </small>
          )}
        </label>

        <label className="clinical-form-full">
          <span>Observaciones opcionales</span>
          <textarea
            value={formValues.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Notas adicionales de la evolucion clinica"
            rows={3}
          />
        </label>
      </div>

      <div className="clinical-record-actions">
        <button className="primary-action" type="submit">
          Agregar registro
        </button>
      </div>

      <div className="clinical-record-feedback-slot">
        {successMessage && (
          <p className="settings-feedback settings-feedback--success" role="status">
            {successMessage}
          </p>
        )}
      </div>
    </form>
  )
}
