import { useEffect, useState, type FormEvent } from 'react'
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

    const result = await onSaveSettings(formValues)

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
          Configura el número de WhatsApp Business que se usará para enviar
          recordatorios.
        </p>
      </div>

      <div className="settings-note">
        Estado: <strong>{getWhatsappStatusLabel(status)}</strong>
      </div>

      {(errorMessage || actionError) && (
        <p className="field-message field-message--error">
          {actionError || errorMessage}
        </p>
      )}

      <form className="treatment-form" onSubmit={handleSubmit}>
        <label>
          <span>Proveedor</span>
          <select
            value={formValues.provider}
            onChange={(event) =>
              updateField('provider', event.target.value)
            }
          >
            <option value="whatsapp_cloud_api">WhatsApp Cloud API</option>
          </select>
        </label>

        <label>
          <span>Número de WhatsApp</span>
          <input
            type="text"
            placeholder="+59170012345"
            value={formValues.phoneNumber}
            onChange={(event) =>
              updateField('phoneNumber', event.target.value)
            }
          />
        </label>

        <label>
          <span>Phone Number ID</span>
          <input
            type="text"
            value={formValues.phoneNumberId}
            onChange={(event) =>
              updateField('phoneNumberId', event.target.value)
            }
          />
        </label>

        <label>
          <span>Business Account ID</span>
          <input
            type="text"
            value={formValues.businessAccountId}
            onChange={(event) =>
              updateField('businessAccountId', event.target.value)
            }
          />
        </label>

        <label className="business-day-toggle">
          <input
            type="checkbox"
            checked={formValues.isConnected}
            onChange={(event) =>
              updateField('isConnected', event.target.checked)
            }
          />
          <span className="business-switch" aria-hidden="true" />
          <span className="business-switch-label">
            Marcar como conectado
          </span>
        </label>

        <p className="settings-note">
          El token de acceso no se guarda en el frontend. Se configurará de
          forma segura en backend mediante Supabase Secrets.
        </p>

        <button className="primary-action" type="submit">
          Guardar configuración
        </button>
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
    connected: 'Conectado',
    error: 'Error',
    'not-configured': 'No configurado',
    pending: 'Pendiente de configuración',
  }

  return labels[status]
}
