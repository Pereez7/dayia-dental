import { useEffect, useState, type FormEvent } from 'react'
import type { Treatment, TreatmentId } from '../types/Treatment'
import {
  allowedTreatmentDurations,
  defaultTreatmentDurationMinutes,
  filterTreatmentsBySearch,
  formatTreatmentName,
  validateTreatmentDuration,
  validateTreatmentName,
} from '../utils/treatmentUtils'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'

interface TreatmentsSettingsProps {
  errorMessage?: string
  treatments: Treatment[]
  onCreateTreatment: (
    treatment: Omit<Treatment, 'id'>,
  ) => Promise<TreatmentActionResult> | TreatmentActionResult
  onSetTreatmentActive: (
    treatmentId: TreatmentId,
    isActive: boolean,
  ) => Promise<TreatmentActionResult> | TreatmentActionResult
  onUpdateTreatment: (
    treatmentId: TreatmentId,
    treatment: Omit<Treatment, 'id'>,
  ) => Promise<TreatmentActionResult> | TreatmentActionResult
}

interface TreatmentActionResult {
  error?: string
  success: boolean
}

export function TreatmentsSettings({
  errorMessage = '',
  treatments,
  onCreateTreatment,
  onSetTreatmentActive,
  onUpdateTreatment,
}: TreatmentsSettingsProps) {
  const [treatmentName, setTreatmentName] = useState('')
  const [treatmentDuration, setTreatmentDuration] = useState(
    defaultTreatmentDurationMinutes,
  )
  const [searchText, setSearchText] = useState('')
  const [editingTreatmentId, setEditingTreatmentId] =
    useState<TreatmentId | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDuration, setEditingDuration] = useState(
    defaultTreatmentDurationMinutes,
  )
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [treatmentIdPendingDeactivation, setTreatmentIdPendingDeactivation] =
    useState<TreatmentId | null>(null)
  const [actionError, setActionError] = useState('')
  const filteredTreatments = filterTreatmentsBySearch(treatments, searchText)

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateTreatmentName(treatments, treatmentName)
    const durationError = validateTreatmentDuration(treatmentDuration)
    setIsToastVisible(false)

    if (validationError || durationError) {
      setToastMessage(validationError || durationError)
      setToastTone('warning')
      setIsToastVisible(true)
      return
    }

    const result = await onCreateTreatment({
      durationMinutes: treatmentDuration,
      name: formatTreatmentName(treatmentName),
      isActive: true,
    })

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos guardar el tratamiento.')
      return
    }

    setTreatmentName('')
    setTreatmentDuration(defaultTreatmentDurationMinutes)
    setToastMessage('Tratamiento agregado.')
    setToastTone('success')
    setIsToastVisible(true)
  }

  async function toggleTreatment(treatmentId: TreatmentId) {
    const targetTreatment = treatments.find(
      (treatment) => treatment.id === treatmentId,
    )

    const nextIsActive = !targetTreatment?.isActive
    const result = await onSetTreatmentActive(treatmentId, nextIsActive)

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos actualizar el tratamiento.')
      return
    }

    setActionError('')
    setToastMessage(
      targetTreatment?.isActive
        ? 'Tratamiento desactivado.'
        : 'Tratamiento activado.',
    )
    setToastTone(targetTreatment?.isActive ? 'warning' : 'success')
    setIsToastVisible(true)
  }

  function requestTreatmentDeactivation(treatmentId: TreatmentId) {
    setTreatmentIdPendingDeactivation(treatmentId)
    setIsToastVisible(false)
  }

  function cancelTreatmentDeactivation() {
    setTreatmentIdPendingDeactivation(null)
  }

  async function confirmTreatmentDeactivation() {
    if (treatmentIdPendingDeactivation === null) {
      return
    }

    const targetTreatment = treatments.find(
      (treatment) => treatment.id === treatmentIdPendingDeactivation,
    )

    if (!targetTreatment || !targetTreatment.isActive) {
      setTreatmentIdPendingDeactivation(null)
      return
    }

    await toggleTreatment(targetTreatment.id)
    setTreatmentIdPendingDeactivation(null)
  }

  function updateTreatmentName(value: string) {
    setTreatmentName(value)
    setIsToastVisible(false)
    setActionError('')
  }

  function startEditing(treatment: Treatment) {
    setEditingTreatmentId(treatment.id)
    setEditingName(treatment.name)
    setEditingDuration(treatment.durationMinutes)
    setIsToastVisible(false)
    setActionError('')
  }

  function cancelEditing() {
    setEditingTreatmentId(null)
    setEditingName('')
    setEditingDuration(defaultTreatmentDurationMinutes)
  }

  async function saveEditing(treatmentId: TreatmentId) {
    const targetTreatment = treatments.find(
      (treatment) => treatment.id === treatmentId,
    )
    const validationError = validateTreatmentName(
      treatments,
      editingName,
      treatmentId,
    )
    const durationError = validateTreatmentDuration(editingDuration)
    setIsToastVisible(false)

    if (validationError || durationError) {
      setToastMessage(validationError || durationError)
      setToastTone('warning')
      setIsToastVisible(true)
      return
    }

    if (!targetTreatment) {
      showActionError('No encontramos el tratamiento seleccionado.')
      return
    }

    const result = await onUpdateTreatment(treatmentId, {
      durationMinutes: editingDuration,
      isActive: targetTreatment.isActive,
      name: formatTreatmentName(editingName),
    })

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos actualizar el tratamiento.')
      return
    }

    setActionError('')
    cancelEditing()
    setToastMessage('Tratamiento actualizado.')
    setToastTone('warning')
    setIsToastVisible(true)
  }

  function updateEditingName(value: string) {
    setEditingName(value)
    setIsToastVisible(false)
    setActionError('')
  }

  function updateTreatmentDuration(value: string) {
    setTreatmentDuration(Number(value))
    setIsToastVisible(false)
    setActionError('')
  }

  function updateEditingDuration(value: string) {
    setEditingDuration(Number(value))
    setIsToastVisible(false)
    setActionError('')
  }

  function showActionError(message: string) {
    setActionError(message)
    setToastMessage(message)
    setToastTone('error')
    setIsToastVisible(true)
  }

  return (
    <section
      className="settings-panel treatments-panel"
      aria-labelledby="treatments-settings-title"
    >
      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel="Sí, desactivar"
        isOpen={treatmentIdPendingDeactivation !== null}
        message="¿Seguro que deseas desactivar este tratamiento? No aparecerá al crear nuevas citas, pero las citas existentes conservarán este dato."
        title="Desactivar tratamiento"
        variant="danger"
        onCancel={cancelTreatmentDeactivation}
        onConfirm={confirmTreatmentDeactivation}
      />

      <div className="section-heading">
        <h2 id="treatments-settings-title">Tratamientos del consultorio</h2>
        <p className="section-description">
          Administra los tratamientos que estaran disponibles al crear una cita.
        </p>
      </div>

      {(errorMessage || actionError) && (
        <p className="field-message field-message--error">
          {actionError || errorMessage}
        </p>
      )}

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

        <label>
          <span>Duración</span>
          <select
            value={treatmentDuration}
            onChange={(event) => updateTreatmentDuration(event.target.value)}
          >
            {allowedTreatmentDurations.map((duration) => (
              <option key={duration} value={duration}>
                {duration} min
              </option>
            ))}
          </select>
        </label>

        <button className="primary-action" type="submit">
          Agregar tratamiento
        </button>
      </form>

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

                  <label>
                    <span>Duración</span>
                    <select
                      value={editingDuration}
                      onChange={(event) =>
                        updateEditingDuration(event.target.value)
                      }
                    >
                      {allowedTreatmentDurations.map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} min
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <div className="treatment-meta">
                    <span
                      className={`treatment-status${
                        treatment.isActive ? ' treatment-status--active' : ''
                      }`}
                    >
                      {treatment.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="treatment-duration">
                      {treatment.durationMinutes} min
                    </span>
                  </div>
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
                    onClick={() =>
                      treatment.isActive
                        ? requestTreatmentDeactivation(treatment.id)
                        : toggleTreatment(treatment.id)
                    }
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

      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
      />
    </section>
  )
}
