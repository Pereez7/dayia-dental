import { useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  WhatsappConnectionStatus,
  WhatsappSettings,
  WhatsappSettingsFormValues,
} from '../types/WhatsApp'
import { getWhatsappConnectionStatus } from '../services/whatsappSettingsService'
import { Toast, type ToastTone } from './Toast'

interface WhatsappSettingsPanelProps {
  errorMessage?: string
  onSaveSettings: (
    values: WhatsappSettingsFormValues,
  ) => Promise<WhatsappSettingsActionResult> | WhatsappSettingsActionResult
  settings: WhatsappSettings | null
}

interface WhatsappSettingsActionResult {
  error?: string
  success: boolean
}

const defaultFormValues: WhatsappSettingsFormValues = {
  businessAccountId: '',
  isConnected: false,
  phoneNumber: '',
  phoneNumberId: '',
  provider: 'whatsapp_cloud_api',
}

export function WhatsappSettingsPanel({
  errorMessage = '',
  onSaveSettings,
  settings,
}: WhatsappSettingsPanelProps) {
  const [formValues, setFormValues] =
    useState<WhatsappSettingsFormValues>(() =>
      settings ? mapSettingsToFormValues(settings) : defaultFormValues,
    )
  const [actionError, setActionError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionLock = useRef(false)
  const status = getWhatsappConnectionStatus(settings)

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

  function updateField(
    field: keyof WhatsappSettingsFormValues,
    value: string | boolean,
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setActionError('')
    setIsToastVisible(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)
    let result: Awaited<ReturnType<typeof onSaveSettings>>

    try {
      result = await onSaveSettings(formValues)
    } catch {
      result = {
        error: 'No pudimos guardar la configuración. Intenta nuevamente.',
        success: false,
      }
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos guardar WhatsApp.')
      return
    }

    setActionError('')
    setToastMessage('Configuración de WhatsApp guardada.')
    setToastTone('success')
    setIsToastVisible(true)
  }

  function showActionError(message: string) {
    setActionError(message)
    setToastMessage(message)
    setToastTone('error')
    setIsToastVisible(true)
  }

  return (
    <section
      className="settings-panel whatsapp-settings-panel"
      aria-labelledby="whatsapp-settings-title"
    >
      <div className="section-heading">
        <h2 id="whatsapp-settings-title">WhatsApp del consultorio</h2>
        <p className="section-description">
          Configura el número de WhatsApp Business usado en los recordatorios
          manuales.
        </p>
      </div>

      <div className="whatsapp-connection-status" aria-live="polite">
        <span>Estado de conexión</span>
        <strong
          className={`whatsapp-status-badge whatsapp-status-badge--${status}`}
        >
          {getWhatsappStatusLabel(status)}
        </strong>
        <p>{getWhatsappStatusDescription(status)}</p>
      </div>

      {(errorMessage || actionError) && (
        <p className="field-message field-message--error">
          {actionError || errorMessage}
        </p>
      )}

      <form className="whatsapp-settings-form" onSubmit={handleSubmit}>
        <div className="whatsapp-form-section">
          <label className="whatsapp-field">
            <span>Número de WhatsApp</span>
            <input
              type="text"
              disabled={isSubmitting}
              placeholder="Ej. +59170012345"
              value={formValues.phoneNumber}
              onChange={(event) =>
                updateField('phoneNumber', event.target.value)
              }
            />
          </label>
        </div>

        <fieldset className="whatsapp-technical-fields">
          <legend>Datos técnicos de conexión</legend>
          <p>
            Estos datos se completan al conectar el número de WhatsApp
            Business.
          </p>
          <div className="whatsapp-technical-grid">
            <label className="whatsapp-field">
              <span>Phone Number ID</span>
              <input
                type="text"
                disabled={isSubmitting}
                value={formValues.phoneNumberId}
                onChange={(event) =>
                  updateField('phoneNumberId', event.target.value)
                }
              />
            </label>

            <label className="whatsapp-field">
              <span>Business Account ID</span>
              <input
                type="text"
                disabled={isSubmitting}
                value={formValues.businessAccountId}
                onChange={(event) =>
                  updateField('businessAccountId', event.target.value)
                }
              />
            </label>
          </div>
        </fieldset>

        <p className="whatsapp-info-note">
          Actualmente el envío es manual desde WhatsApp. El envío automático
          está preparado para una etapa posterior.
        </p>

        <div className="whatsapp-settings-actions">
          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>

      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
      />
    </section>
  )
}

function mapSettingsToFormValues(
  settings: WhatsappSettings,
): WhatsappSettingsFormValues {
  return {
    businessAccountId: settings.businessAccountId,
    isConnected: settings.isConnected,
    phoneNumber: settings.phoneNumber,
    phoneNumberId: settings.phoneNumberId,
    provider: settings.provider,
  }
}

function getWhatsappStatusLabel(status: WhatsappConnectionStatus) {
  const labels: Record<WhatsappConnectionStatus, string> = {
    connected: 'Configuración completa',
    error: 'Revisar configuración',
    'not-configured': 'No configurado',
    pending: 'Pendiente de configuración',
  }

  return labels[status]
}

function getWhatsappStatusDescription(status: WhatsappConnectionStatus) {
  const descriptions: Record<WhatsappConnectionStatus, string> = {
    connected: 'Los datos están completos; el envío automático aún no está activo.',
    error: 'Revisa los datos antes de continuar con la conexión.',
    'not-configured': 'Agrega el número autorizado para iniciar la configuración.',
    pending: 'Hay datos guardados, pero la conexión aún no está completa.',
  }

  return descriptions[status]
}
