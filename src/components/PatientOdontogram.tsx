import { useState, type FormEvent } from 'react'
import type {
  OdontogramEntry,
  OdontogramFormErrors,
  OdontogramFormValues,
  ToothStatus,
} from '../types/Odontogram'
import {
  generateAdultTeethNumbers,
  getToothEntry,
  getToothStatus,
  hasOdontogramFormErrors,
  normalizeOdontogramNotes,
  summarizeToothStatuses,
  toothStatusLabels,
  toothStatusShortLabels,
  toothStatuses,
  validateOdontogramForm,
} from '../utils/odontogram'
import { formatCompactDateWithYear } from '../utils/dateFormatters'

interface PatientOdontogramProps {
  entries: OdontogramEntry[]
  onSaveTooth: (toothNumber: number, values: OdontogramFormValues) => void
}

export function PatientOdontogram({
  entries,
  onSaveTooth,
}: PatientOdontogramProps) {
  const teethNumbers = generateAdultTeethNumbers()
  const summary = summarizeToothStatuses(entries)
  const [selectedToothNumber, setSelectedToothNumber] = useState<number | null>(
    null,
  )
  const [formValues, setFormValues] = useState<OdontogramFormValues>({
    notes: '',
    status: '',
  })
  const [errors, setErrors] = useState<OdontogramFormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const selectedEntry = selectedToothNumber
    ? getToothEntry(entries, selectedToothNumber)
    : undefined

  function selectTooth(toothNumber: number) {
    const toothEntry = getToothEntry(entries, toothNumber)

    setSelectedToothNumber(toothNumber)
    setFormValues({
      notes: toothEntry?.notes ?? '',
      status: toothEntry?.status ?? 'healthy',
    })
    setErrors({})
    setSuccessMessage('')
  }

  function updateField(field: keyof OdontogramFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedToothNumber === null) {
      return
    }

    const validationErrors = validateOdontogramForm(formValues)
    setErrors(validationErrors)

    if (hasOdontogramFormErrors(validationErrors)) {
      return
    }

    onSaveTooth(selectedToothNumber, {
      notes: normalizeOdontogramNotes(formValues.notes),
      status: formValues.status,
    })
    setFormValues((currentValues) => ({
      ...currentValues,
      notes: normalizeOdontogramNotes(currentValues.notes),
    }))
    setSuccessMessage('Pieza dental actualizada correctamente.')
  }

  return (
    <section className="odontogram-section" aria-label="Odontograma del paciente">
      <div className="odontogram-summary">
        {toothStatuses.map((status) => (
          <div className="odontogram-summary-item" key={status}>
            <strong>{summary[status]}</strong>
            <span>{toothStatusShortLabels[status]}</span>
          </div>
        ))}
      </div>

      <div className="odontogram-layout">
        <div className="odontogram-grid" aria-label="Piezas dentales permanentes">
          {teethNumbers.map((toothNumber) => {
            const status = getToothStatus(entries, toothNumber)
            const isSelected = toothNumber === selectedToothNumber

            return (
              <button
                aria-pressed={isSelected}
                className={`tooth-card odontogram-status--${status}`}
                key={toothNumber}
                type="button"
                onClick={() => selectTooth(toothNumber)}
              >
                <strong>{toothNumber}</strong>
                <span>{toothStatusShortLabels[status]}</span>
              </button>
            )
          })}
        </div>

        <form className="odontogram-editor" onSubmit={handleSubmit}>
          <div className="section-heading">
            <p className="eyebrow">Pieza dental</p>
            <h3>
              {selectedToothNumber
                ? `Pieza ${selectedToothNumber}`
                : 'Selecciona una pieza'}
            </h3>
            <p className="section-description">
              Actualiza el estado actual de la pieza seleccionada.
            </p>
          </div>

          <label>
            <span>Estado</span>
            <select
              disabled={selectedToothNumber === null}
              value={formValues.status}
              onChange={(event) =>
                updateField('status', event.target.value as ToothStatus)
              }
            >
              <option value="">Seleccionar estado</option>
              {toothStatuses.map((status) => (
                <option key={status} value={status}>
                  {toothStatusLabels[status]}
                </option>
              ))}
            </select>
            {errors.status && (
              <small className="field-message field-message--error">
                {errors.status}
              </small>
            )}
          </label>

          <label>
            <span>Observaciones</span>
            <textarea
              disabled={selectedToothNumber === null}
              value={formValues.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Ej. Controlar sensibilidad"
              rows={4}
            />
          </label>

          {selectedEntry && (
            <p className="odontogram-updated-at">
              Última actualización:{' '}
              {formatCompactDateWithYear(selectedEntry.updatedAt)}
            </p>
          )}

          <button
            className="primary-action"
            disabled={selectedToothNumber === null}
            type="submit"
          >
            Guardar pieza
          </button>

          <div className="clinical-record-feedback-slot">
            {successMessage && (
              <p
                className="settings-feedback settings-feedback--success"
                role="status"
              >
                {successMessage}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
