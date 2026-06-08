import { useState, type FormEvent } from 'react'
import type { Treatment } from '../types/Treatment'
import {
  filterTreatmentsBySearch,
  formatTreatmentName,
  validateTreatmentName,
} from '../utils/treatmentUtils'

type FeedbackTone = 'success' | 'warning' | 'danger'

interface TreatmentsSettingsProps {
  treatments: Treatment[]
  onTreatmentsChange: (treatments: Treatment[]) => void
}

export function TreatmentsSettings({
  treatments,
  onTreatmentsChange,
}: TreatmentsSettingsProps) {
  const [treatmentName, setTreatmentName] = useState('')
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [editingTreatmentId, setEditingTreatmentId] = useState<number | null>(
    null,
  )
  const [editingName, setEditingName] = useState('')
  const [editingError, setEditingError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('success')
  const filteredTreatments = filterTreatmentsBySearch(treatments, searchText)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateTreatmentName(treatments, treatmentName)
    setError(validationError)
    setSuccessMessage('')

    if (validationError) {
      return
    }

    const newTreatment: Treatment = {
      id: Date.now(),
      name: formatTreatmentName(treatmentName),
      isActive: true,
    }

    onTreatmentsChange([...treatments, newTreatment])
    setTreatmentName('')
    setSuccessMessage('Tratamiento agregado correctamente.')
    setFeedbackTone('success')
  }

  function toggleTreatment(treatmentId: number) {
    const targetTreatment = treatments.find(
      (treatment) => treatment.id === treatmentId,
    )

    onTreatmentsChange(
      treatments.map((treatment) =>
        treatment.id === treatmentId
          ? { ...treatment, isActive: !treatment.isActive }
          : treatment,
      ),
    )
    setSuccessMessage(
      targetTreatment?.isActive
        ? 'Tratamiento desactivado.'
        : 'Tratamiento activado.',
    )
    setFeedbackTone(targetTreatment?.isActive ? 'danger' : 'success')
  }

  function updateTreatmentName(value: string) {
    setTreatmentName(value)
    setError('')
    setSuccessMessage('')
  }

  function startEditing(treatment: Treatment) {
    setEditingTreatmentId(treatment.id)
    setEditingName(treatment.name)
    setEditingError('')
    setSuccessMessage('')
  }

  function cancelEditing() {
    setEditingTreatmentId(null)
    setEditingName('')
    setEditingError('')
  }

  function saveEditing(treatmentId: number) {
    const validationError = validateTreatmentName(
      treatments,
      editingName,
      treatmentId,
    )
    setEditingError(validationError)
    setSuccessMessage('')

    if (validationError) {
      return
    }

    onTreatmentsChange(
      treatments.map((treatment) =>
        treatment.id === treatmentId
          ? { ...treatment, name: formatTreatmentName(editingName) }
          : treatment,
      ),
    )
    cancelEditing()
    setSuccessMessage('Tratamiento actualizado correctamente.')
    setFeedbackTone('warning')
  }

  function updateEditingName(value: string) {
    setEditingName(value)
    setEditingError('')
    setSuccessMessage('')
  }

  return (
    <section
      className="settings-panel"
      aria-labelledby="treatments-settings-title"
    >
      <div className="section-heading">
        <h2 id="treatments-settings-title">Tratamientos del consultorio</h2>
        <p className="section-description">
          Administra los tratamientos que estaran disponibles al crear una cita.
        </p>
      </div>

      <form className="treatment-form" onSubmit={handleSubmit}>
        <label>
          <span>Nuevo tratamiento</span>
          <input
            type="text"
            value={treatmentName}
            onChange={(event) => updateTreatmentName(event.target.value)}
            placeholder="Ej. Implante dental"
          />
        </label>

        <button className="primary-action" type="submit">
          Agregar tratamiento
        </button>

        <div className="appointment-message-slot treatment-form-message">
          {error && <p className="field-message field-message--error">{error}</p>}
        </div>
      </form>

      <div className="settings-feedback-slot">
        {successMessage && (
          <p
            className={`settings-feedback settings-feedback--${feedbackTone}`}
            role="status"
          >
            {successMessage}
          </p>
        )}
      </div>

      <label className="treatment-search">
        <span>Buscar tratamiento</span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Nombre del tratamiento"
        />
      </label>

      <div className="treatment-list">
        {filteredTreatments.map((treatment) => (
          <article className="treatment-row" key={treatment.id}>
            {editingTreatmentId === treatment.id ? (
              <>
                <div className="treatment-edit-field">
                  <label>
                    <span>Nombre del tratamiento</span>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(event) =>
                        updateEditingName(event.target.value)
                      }
                    />
                  </label>
                  <div className="appointment-message-slot">
                    {editingError && (
                      <p className="field-message field-message--error">
                        {editingError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="treatment-row-actions">
                  <button
                    className="warning-action"
                    type="button"
                    onClick={() => saveEditing(treatment.id)}
                  >
                    Guardar
                  </button>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={cancelEditing}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3>{treatment.name}</h3>
                  <span
                    className={`treatment-status${
                      treatment.isActive ? ' treatment-status--active' : ''
                    }`}
                  >
                    {treatment.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="treatment-row-actions">
                  <button
                    className="warning-action"
                    type="button"
                    onClick={() => startEditing(treatment)}
                  >
                    Editar
                  </button>
                  <button
                    className={
                      treatment.isActive ? 'danger-action' : 'success-action'
                    }
                    type="button"
                    onClick={() => toggleTreatment(treatment.id)}
                  >
                    {treatment.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {filteredTreatments.length === 0 && (
        <p className="dashboard-empty-state">
          No encontramos tratamientos con esa busqueda.
        </p>
      )}

      <p className="settings-note">
        Desactivar tratamientos conserva las citas relacionadas y evita perder
        referencias historicas.
      </p>
    </section>
  )
}
