import { useEffect, useState, type FormEvent } from 'react'
import type {
  OdontogramEntry,
  OdontogramFormErrors,
  OdontogramFormValues,
  OdontogramSaveResult,
  ToothCode,
  ToothStatus,
} from '../types/Odontogram'
import {
  generateAdultTeethGroups,
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
import { formatAppDate } from '../utils/dateFormatters'
import { Toast } from './Toast'

interface PatientOdontogramProps {
  entries: OdontogramEntry[]
  errorMessage?: string
  isLoading?: boolean
  onSaveTooth: (
    toothCode: ToothCode,
    values: OdontogramFormValues,
  ) => Promise<OdontogramSaveResult> | OdontogramSaveResult
}

const ODONTOGRAM_NOTES_MAX_LENGTH = 160

export function PatientOdontogram({
  entries,
  errorMessage = '',
  isLoading = false,
  onSaveTooth,
}: PatientOdontogramProps) {
  const teethGroups = generateAdultTeethGroups()
  const summary = summarizeToothStatuses(entries)
  const [selectedToothCode, setSelectedToothCode] = useState<ToothCode | null>(
    null,
  )
  const [formValues, setFormValues] = useState<OdontogramFormValues>({
    notes: '',
    status: '',
  })
  const [errors, setErrors] = useState<OdontogramFormErrors>({})
  const [toastMessage, setToastMessage] = useState('')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const selectedEntry = selectedToothCode
    ? getToothEntry(entries, selectedToothCode)
    : undefined
  const selectedToothStatus = selectedToothCode
    ? getToothStatus(entries, selectedToothCode)
    : undefined
  const remainingNotesCharacters =
    ODONTOGRAM_NOTES_MAX_LENGTH - formValues.notes.length
  const isNotesLimitClose = remainingNotesCharacters <= 20

  useEffect(() => {
    if (!isToastVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsToastVisible(false), 3200)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  useEffect(() => {
    if (isToastVisible || !toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 220)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  function selectTooth(toothCode: ToothCode) {
    const toothEntry = getToothEntry(entries, toothCode)

    setSelectedToothCode(toothCode)
    setFormValues({
      notes: toothEntry?.notes ?? '',
      status: toothEntry?.status ?? 'healthy',
    })
    setErrors({})
    setSaveError('')
    setIsToastVisible(false)
  }

  function updateField(field: keyof OdontogramFormValues, value: string) {
    const nextValue =
      field === 'notes' ? value.slice(0, ODONTOGRAM_NOTES_MAX_LENGTH) : value

    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: nextValue,
    }))
    setIsToastVisible(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedToothCode === null) {
      return
    }

    const validationErrors = validateOdontogramForm(formValues)
    setErrors(validationErrors)

    if (hasOdontogramFormErrors(validationErrors)) {
      return
    }

    setIsSaving(true)
    setSaveError('')
    const result = await onSaveTooth(selectedToothCode, {
      notes: normalizeOdontogramNotes(formValues.notes),
      status: formValues.status,
    })
    setIsSaving(false)

    if (!result.success) {
      setSaveError(result.error ?? 'No pudimos guardar la pieza dental.')
      return
    }

    setFormValues((currentValues) => ({
      ...currentValues,
      notes: normalizeOdontogramNotes(currentValues.notes),
    }))
    setToastMessage('Pieza dental actualizada.')
    setIsToastVisible(true)
  }

  return (
    <section className="odontogram-section" aria-label="Odontograma del paciente">
      <div className="odontogram-summary">
        {toothStatuses.map((status) => (
          <div
            className={`odontogram-summary-item odontogram-status-summary--${status}`}
            key={status}
          >
            <strong>{summary[status]}</strong>
            <span>{toothStatusShortLabels[status]}</span>
          </div>
        ))}
      </div>

      <div className="odontogram-layout">
        <div
          className="odontogram-map"
          aria-label="Piezas dentales permanentes"
        >
          <div className="odontogram-legend" aria-label="Leyenda de estados">
            {toothStatuses.map((status) => (
              <span className="odontogram-legend-item" key={status}>
                <span
                  className={`odontogram-legend-dot odontogram-status-dot--${status}`}
                  aria-hidden="true"
                />
                {toothStatusShortLabels[status]}
              </span>
            ))}
          </div>

          {teethGroups.map((group) => (
            <section className="odontogram-arch" key={group.id}>
              <div className="odontogram-arch-header">
                <h4>{group.label}</h4>
                <span>{group.range}</span>
              </div>

              <div className="odontogram-quadrants">
                {group.quadrants.map((quadrant) => (
                  <div className="odontogram-quadrant" key={quadrant.label}>
                    <div className="odontogram-quadrant-header">
                      <p>{quadrant.label}</p>
                      <span>{quadrant.range}</span>
                    </div>
                    <div className="odontogram-tooth-row">
                      {quadrant.teeth.map((toothCode) => {
                        const status = getToothStatus(entries, toothCode)
                        const isSelected = toothCode === selectedToothCode

                        return (
                          <button
                            aria-label={`Pieza ${toothCode}, ${toothStatusLabels[status]}`}
                            aria-pressed={isSelected}
                            className={`tooth-card odontogram-status--${status}`}
                            disabled={isLoading || isSaving}
                            key={toothCode}
                            type="button"
                            onClick={() => selectTooth(toothCode)}
                          >
                            <strong>{toothCode}</strong>
                            <span>{toothStatusShortLabels[status]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <form className="odontogram-editor" onSubmit={handleSubmit}>
          <div className="section-heading">
            <p className="eyebrow">Pieza dental</p>
            <h3>
              {selectedToothCode
                ? `Pieza ${selectedToothCode}`
                : 'Selecciona una pieza'}
            </h3>
            <p className="section-description">
              Actualiza el estado actual de la pieza seleccionada.
            </p>
          </div>

          <div className="odontogram-current-state">
            <span>Estado actual</span>
            <strong
              className={`odontogram-current-state-badge odontogram-status-badge--${selectedToothStatus ?? 'other'}`}
            >
              {selectedToothStatus
                ? toothStatusLabels[selectedToothStatus]
                : 'Sin pieza seleccionada'}
            </strong>
          </div>

          <label>
            <span>Estado</span>
            <select
              aria-invalid={Boolean(errors.status)}
              disabled={selectedToothCode === null || isLoading || isSaving}
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
              disabled={selectedToothCode === null || isLoading || isSaving}
              maxLength={ODONTOGRAM_NOTES_MAX_LENGTH}
              value={formValues.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Ej. Controlar sensibilidad"
              rows={4}
            />
            <small
              className={`odontogram-character-counter${
                isNotesLimitClose ? ' odontogram-character-counter--warning' : ''
              }`}
            >
              {formValues.notes.length} / {ODONTOGRAM_NOTES_MAX_LENGTH}
            </small>
          </label>

          {selectedEntry && (
            <p className="odontogram-updated-at">
              Última actualización: {formatAppDate(selectedEntry.updatedAt)}
            </p>
          )}

          {(errorMessage || saveError) && (
            <p className="field-message field-message--error" role="alert">
              {saveError || errorMessage}
            </p>
          )}

          <button
            className="primary-action odontogram-save-button"
            disabled={selectedToothCode === null || isLoading || isSaving}
            type="submit"
          >
            {isSaving ? 'Guardando...' : 'Guardar pieza'}
          </button>
        </form>
      </div>

      <Toast message={toastMessage} tone="success" visible={isToastVisible} />
    </section>
  )
}
