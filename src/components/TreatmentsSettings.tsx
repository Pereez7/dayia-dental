import { useEffect, useState, type FormEvent } from 'react'
import type { Treatment } from '../types/Treatment'
import {
  filterTreatmentsBySearch,
  formatTreatmentName,
  validateTreatmentName,
} from '../utils/treatmentUtils'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'

interface TreatmentsSettingsProps {
  treatments: Treatment[]
  onTreatmentsChange: (treatments: Treatment[]) => void
}

export function TreatmentsSettings({
  treatments,
  onTreatmentsChange,
}: TreatmentsSettingsProps) {
  const [treatmentName, setTreatmentName] = useState('')
  const [searchText, setSearchText] = useState('')
  const [editingTreatmentId, setEditingTreatmentId] = useState<number | null>(
    null,
  )
  const [editingName, setEditingName] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [treatmentIdPendingDeactivation, setTreatmentIdPendingDeactivation] =
    useState<number | null>(null)
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateTreatmentName(treatments, treatmentName)
    setIsToastVisible(false)

    if (validationError) {
      setToastMessage(validationError)
      setToastTone('warning')
      setIsToastVisible(true)
      return
    }

    const newTreatment: Treatment = {
      id: Date.now(),
      name: formatTreatmentName(treatmentName),
      isActive: true,
    }

    onTreatmentsChange([...treatments, newTreatment])
    setTreatmentName('')
    setToastMessage('Tratamiento agregado.')
    setToastTone('success')
    setIsToastVisible(true)
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
    setToastMessage(
      targetTreatment?.isActive
        ? 'Tratamiento desactivado.'
        : 'Tratamiento activado.',
    )
    setToastTone(targetTreatment?.isActive ? 'warning' : 'success')
    setIsToastVisible(true)
  }

  function requestTreatmentDeactivation(treatmentId: number) {
    setTreatmentIdPendingDeactivation(treatmentId)
    setIsToastVisible(false)
  }

  function cancelTreatmentDeactivation() {
    setTreatmentIdPendingDeactivation(null)
  }

  function confirmTreatmentDeactivation() {
    if (treatmentIdPendingDeactivation === null) {
      return
    }

    const targetTreatment = treatments.find(
      (treatment) => treatment.id === treatmentIdPendingDeactivation,
    )

    setTreatmentIdPendingDeactivation(null)

    if (!targetTreatment || !targetTreatment.isActive) {
      return
    }

    toggleTreatment(targetTreatment.id)
  }

  function updateTreatmentName(value: string) {
    setTreatmentName(value)
    setIsToastVisible(false)
  }

  function startEditing(treatment: Treatment) {
    setEditingTreatmentId(treatment.id)
    setEditingName(treatment.name)
    setIsToastVisible(false)
  }

  function cancelEditing() {
    setEditingTreatmentId(null)
    setEditingName('')
  }

  function saveEditing(treatmentId: number) {
    const validationError = validateTreatmentName(
      treatments,
      editingName,
      treatmentId,
    )
    setIsToastVisible(false)

    if (validationError) {
      setToastMessage(validationError)
      setToastTone('warning')
      setIsToastVisible(true)
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
    setToastMessage('Tratamiento actualizado.')
    setToastTone('warning')
    setIsToastVisible(true)
  }

  function updateEditingName(value: string) {
    setEditingName(value)
    setIsToastVisible(false)
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
