import { useEffect, useState, type FormEvent } from 'react'
import type {
  AppointmentInterval,
  BusinessDaySchedule,
  BusinessHoursErrors,
  BusinessHoursSettings as BusinessHoursSettingsType,
  CalendarException,
  CalendarExceptionId,
  CalendarExceptionFormErrors,
  CalendarExceptionFormValues,
  CalendarExceptionReason,
  CalendarExceptionType,
  Weekday,
} from '../types/BusinessHours'
import {
  appointmentIntervals,
  areBusinessHoursSettingsEqual,
  calendarExceptionReasonLabels,
  hasCalendarExceptionFormErrors,
  hasBusinessHoursErrors,
  isValidBusinessTimeFormat,
  validateCalendarExceptionForm,
  validateBusinessHours,
  weekdayLabels,
} from '../utils/businessHours'
import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'

interface BusinessHoursSettingsProps {
  calendarExceptions: CalendarException[]
  errorMessage?: string
  isBusinessHoursConfigured?: boolean
  settings: BusinessHoursSettingsType
  onCreateCalendarException: (
    values: CalendarExceptionFormValues,
  ) => Promise<BusinessSettingsActionResult> | BusinessSettingsActionResult
  onDeleteCalendarException: (
    exceptionId: CalendarExceptionId,
  ) => Promise<BusinessSettingsActionResult> | BusinessSettingsActionResult
  onSettingsChange: (
    settings: BusinessHoursSettingsType,
  ) => Promise<BusinessSettingsActionResult> | BusinessSettingsActionResult
}

interface BusinessSettingsActionResult {
  error?: string
  success: boolean
}

const emptyCalendarExceptionValues: CalendarExceptionFormValues = {
  date: '',
  endTime: '',
  reason: '',
  reasonDetail: '',
  startTime: '',
  type: 'closed',
}

const calendarExceptionTypeLabels: Record<CalendarExceptionType, string> = {
  closed: 'Cerrado',
  'special-hours': 'Horario especial',
}

const calendarExceptionReasonOptions: CalendarExceptionReason[] = [
  '',
  'holiday',
  'maintenance',
  'doctor-travel',
  'special-campaign',
  'other',
]

export function BusinessHoursSettings({
  calendarExceptions,
  errorMessage = '',
  isBusinessHoursConfigured = true,
  settings: initialSettings,
  onCreateCalendarException,
  onDeleteCalendarException,
  onSettingsChange,
}: BusinessHoursSettingsProps) {
  const [settings, setSettings] =
    useState<BusinessHoursSettingsType>(initialSettings)
  const [savedSettings, setSavedSettings] =
    useState<BusinessHoursSettingsType>(initialSettings)
  const [errors, setErrors] = useState<BusinessHoursErrors>({})
  const [calendarExceptionValues, setCalendarExceptionValues] =
    useState<CalendarExceptionFormValues>(emptyCalendarExceptionValues)
  const [calendarExceptionErrors, setCalendarExceptionErrors] =
    useState<CalendarExceptionFormErrors>({})
  const [calendarExceptionIdPendingDeletion, setCalendarExceptionIdPendingDeletion] =
    useState<CalendarExceptionId | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [actionError, setActionError] = useState('')
  const sortedCalendarExceptions = [...calendarExceptions].sort((first, second) =>
    first.date.localeCompare(second.date),
  )

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

  function updateDaySchedule(
    day: Weekday,
    values: Partial<BusinessDaySchedule>,
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      weeklySchedule: currentSettings.weeklySchedule.map((daySchedule) =>
        daySchedule.day === day
          ? { ...daySchedule, ...values }
          : daySchedule,
      ),
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [day]: '',
    }))
    setIsToastVisible(false)
    setActionError('')
  }

  function updateAppointmentInterval(value: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      appointmentInterval: Number(value) as AppointmentInterval,
    }))
    setIsToastVisible(false)
    setActionError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    blurActiveFormElement(event.currentTarget)

    const validationErrors = validateBusinessHours(settings)
    setErrors(validationErrors)

    if (hasBusinessHoursErrors(validationErrors)) {
      setIsToastVisible(false)
      return
    }

    if (areBusinessHoursSettingsEqual(settings, savedSettings)) {
      setIsToastVisible(false)
      return
    }

    const result = await onSettingsChange(settings)

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos guardar los horarios.')
      return
    }

    setSavedSettings(settings)
    setToastMessage('Horarios del consultorio actualizados.')
    setToastTone('success')
    setIsToastVisible(true)
  }

  function updateCalendarExceptionField(
    field: keyof CalendarExceptionFormValues,
    value: string,
  ) {
    setCalendarExceptionValues((currentValues) => {
      const nextValues = {
        ...currentValues,
        [field]: value,
      }

      if (field === 'type' && value === 'closed') {
        nextValues.startTime = ''
        nextValues.endTime = ''
      }

      if (field === 'reason' && value !== 'other') {
        nextValues.reasonDetail = ''
      }

      return nextValues
    })
    setCalendarExceptionErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
    setIsToastVisible(false)
    setActionError('')
  }

  async function handleCalendarExceptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    blurActiveFormElement(event.currentTarget)

    const validationErrors = validateCalendarExceptionForm(
      calendarExceptionValues,
      calendarExceptions,
    )
    setCalendarExceptionErrors(validationErrors)

    if (hasCalendarExceptionFormErrors(validationErrors)) {
      setIsToastVisible(false)
      return
    }

    const result = await onCreateCalendarException(calendarExceptionValues)

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos agregar la excepción.')
      return
    }

    setCalendarExceptionValues(emptyCalendarExceptionValues)
    setCalendarExceptionErrors({})
    setToastMessage('Excepción agregada.')
    setToastTone('success')
    setIsToastVisible(true)
  }

  function requestCalendarExceptionDeletion(exceptionId: CalendarExceptionId) {
    setCalendarExceptionIdPendingDeletion(exceptionId)
    setIsToastVisible(false)
  }

  function cancelCalendarExceptionDeletion() {
    setCalendarExceptionIdPendingDeletion(null)
  }

  async function confirmCalendarExceptionDeletion() {
    if (calendarExceptionIdPendingDeletion === null) {
      return
    }

    const result = await onDeleteCalendarException(
      calendarExceptionIdPendingDeletion,
    )

    if (!result.success) {
      showActionError(result.error ?? 'No pudimos eliminar la excepción.')
      return
    }

    setCalendarExceptionIdPendingDeletion(null)
    setToastMessage('Excepción eliminada.')
    setToastTone('warning')
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
      className="settings-panel business-hours-panel"
      aria-labelledby="business-hours-title"
    >
      <form
        className="business-hours-form business-settings-subpanel"
        onSubmit={handleSubmit}
      >
        <div className="business-hours-header">
          <div className="section-heading">
            <h2 id="business-hours-title">Horarios del consultorio</h2>
            <p className="section-description">
              Define cuándo el consultorio puede recibir citas.
            </p>
          </div>

          <label className="business-interval-field">
            <span>Intervalo de atención</span>
            <select
              value={settings.appointmentInterval}
              onChange={(event) =>
                updateAppointmentInterval(event.target.value)
              }
            >
              {appointmentIntervals.map((interval) => (
                <option key={interval} value={interval}>
                  {interval} minutos
                </option>
              ))}
            </select>
          </label>
        </div>

        {!isBusinessHoursConfigured && (
          <p className="field-message field-message--help">
            Configura los horarios del consultorio para generar citas.
          </p>
        )}

        {(errorMessage || actionError) && (
          <p className="field-message field-message--error">
            {actionError || errorMessage}
          </p>
        )}

        <div className="business-hours-list">
          <div className="business-hours-table-head" aria-hidden="true">
            <span>Día</span>
            <span>Estado</span>
            <span>Inicio</span>
            <span>Fin</span>
          </div>

          {settings.weeklySchedule.map((daySchedule) => (
            <article
              className={`business-day-row${
                daySchedule.isOpen ? '' : ' business-day-row--closed'
              }`}
              key={daySchedule.day}
            >
              <div className="business-day-summary">
                <h3>{weekdayLabels[daySchedule.day]}</h3>
                <span>{daySchedule.isOpen ? 'Abierto' : 'Cerrado'}</span>
              </div>

              <label className="business-day-toggle">
                <input
                  type="checkbox"
                  checked={daySchedule.isOpen}
                  aria-label={`${weekdayLabels[daySchedule.day]} ${
                    daySchedule.isOpen ? 'abierto' : 'cerrado'
                  }`}
                  onChange={(event) =>
                    updateDaySchedule(daySchedule.day, {
                      isOpen: event.target.checked,
                    })
                  }
                />
                <span className="business-switch" aria-hidden="true" />
                <span className="business-switch-label">
                  {daySchedule.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </label>

              <div className="business-time-fields">
                <label>
                  <span>Inicio</span>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={5}
                    pattern="[0-2][0-9]:[0-5][0-9]"
                    placeholder="08:00"
                    value={daySchedule.startTime}
                    disabled={!daySchedule.isOpen}
                    onChange={(event) =>
                      updateDaySchedule(daySchedule.day, {
                        startTime: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Fin</span>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={5}
                    pattern="[0-2][0-9]:[0-5][0-9]"
                    placeholder="18:00"
                    value={daySchedule.endTime}
                    disabled={!daySchedule.isOpen}
                    onChange={(event) =>
                      updateDaySchedule(daySchedule.day, {
                        endTime: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="business-day-message">
                {errors[daySchedule.day] && (
                  <p className="field-message field-message--error">
                    {errors[daySchedule.day]}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="business-hours-actions">
          <button className="primary-action" type="submit">
            Guardar horarios
          </button>
        </div>

      </form>

      <section
        className="business-calendar-note business-settings-subpanel"
        aria-labelledby="calendar-exceptions-title"
      >
        <div className="business-calendar-header">
          <div>
            <h3 id="calendar-exceptions-title">Excepciones del calendario</h3>
            <p>
              Define cierres especiales o un horario distinto para una fecha
              específica.
            </p>
          </div>
        </div>

        <form
          className="calendar-exception-form"
          onSubmit={handleCalendarExceptionSubmit}
        >
          <label>
            <span>Fecha</span>
            <input
              type="date"
              value={calendarExceptionValues.date}
              onChange={(event) =>
                updateCalendarExceptionField('date', event.target.value)
              }
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              value={calendarExceptionValues.type}
              onChange={(event) =>
                updateCalendarExceptionField('type', event.target.value)
              }
            >
              {Object.entries(calendarExceptionTypeLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          {calendarExceptionValues.type === 'special-hours' && (
            <div className="calendar-exception-time-fields">
              <label>
                <span>Inicio</span>
                <input
                  type="text"
                  inputMode="text"
                  maxLength={5}
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  placeholder="09:00"
                  value={calendarExceptionValues.startTime}
                  onChange={(event) =>
                    updateCalendarExceptionField(
                      'startTime',
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                <span>Fin</span>
                <input
                  type="text"
                  inputMode="text"
                  maxLength={5}
                  pattern="[0-2][0-9]:[0-5][0-9]"
                  placeholder="13:00"
                  value={calendarExceptionValues.endTime}
                  onChange={(event) =>
                    updateCalendarExceptionField('endTime', event.target.value)
                  }
                />
              </label>
            </div>
          )}

          <label>
            <span>Motivo opcional</span>
            <select
              value={calendarExceptionValues.reason}
              onChange={(event) =>
                updateCalendarExceptionField('reason', event.target.value)
              }
            >
              {calendarExceptionReasonOptions.map((reason) => (
                <option key={reason || 'empty'} value={reason}>
                  {reason
                    ? calendarExceptionReasonLabels[reason]
                    : 'Sin motivo'}
                </option>
              ))}
            </select>
          </label>

          {calendarExceptionValues.reason === 'other' && (
            <label>
              <span>Detalle</span>
              <input
                type="text"
                maxLength={80}
                placeholder="Describe brevemente el motivo"
                value={calendarExceptionValues.reasonDetail}
                onChange={(event) =>
                  updateCalendarExceptionField(
                    'reasonDetail',
                    event.target.value,
                  )
                }
              />
            </label>
          )}

          <div className="calendar-exception-messages">
            {Object.values(calendarExceptionErrors).map((error) =>
              error ? (
                <p className="field-message field-message--error" key={error}>
                  {error}
                </p>
              ) : null,
            )}
          </div>

          <button className="primary-action" type="submit">
            Agregar excepción
          </button>
        </form>

        <div className="calendar-exception-list">
          {sortedCalendarExceptions.length > 0 ? (
            sortedCalendarExceptions.map((calendarException) => (
              <article
                className="calendar-exception-row"
                key={calendarException.id}
              >
                <div>
                  <h4>{formatCalendarExceptionDate(calendarException.date)}</h4>
                  <p>{getCalendarExceptionSummary(calendarException)}</p>
                  {getCalendarExceptionReasonText(calendarException) && (
                    <span>
                      {getCalendarExceptionReasonText(calendarException)}
                    </span>
                  )}
                </div>
                <button
                  className="danger-action"
                  type="button"
                  onClick={() =>
                    requestCalendarExceptionDeletion(calendarException.id)
                  }
                >
                  Eliminar
                </button>
              </article>
            ))
          ) : (
            <p className="calendar-exception-empty">
              No hay excepciones configuradas.
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel="Sí, eliminar"
        isOpen={calendarExceptionIdPendingDeletion !== null}
        message="¿Seguro que deseas eliminar esta excepción del calendario?"
        title="Eliminar excepción"
        variant="danger"
        onCancel={cancelCalendarExceptionDeletion}
        onConfirm={confirmCalendarExceptionDeletion}
      />

      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
      />
    </section>
  )
}

function formatCalendarExceptionDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(parsedDate)
    .replace('.', '')
}

function getCalendarExceptionSummary(calendarException: CalendarException) {
  if (calendarException.type === 'closed') {
    return 'Cerrado por excepción'
  }

  const startTime = isValidBusinessTimeFormat(calendarException.startTime ?? '')
    ? calendarException.startTime
    : '--:--'
  const endTime = isValidBusinessTimeFormat(calendarException.endTime ?? '')
    ? calendarException.endTime
    : '--:--'

  return `Horario especial: ${startTime} - ${endTime}`
}

function getCalendarExceptionReasonText(
  calendarException: CalendarException,
) {
  if (!calendarException.reason) {
    return ''
  }

  if (calendarException.reason === 'other') {
    return calendarException.reasonDetail
      ? `Motivo: ${calendarException.reasonDetail}`
      : 'Motivo: Otro'
  }

  return `Motivo: ${calendarExceptionReasonLabels[calendarException.reason]}`
}

function blurActiveFormElement(formElement: HTMLFormElement) {
  const activeElement = formElement.ownerDocument.activeElement

  if (
    activeElement instanceof HTMLElement &&
    formElement.contains(activeElement)
  ) {
    activeElement.blur()
  }
}
