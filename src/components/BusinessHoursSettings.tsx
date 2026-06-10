import { useEffect, useState, type FormEvent } from 'react'
import type {
  AppointmentInterval,
  BusinessDaySchedule,
  BusinessHoursErrors,
  BusinessHoursSettings as BusinessHoursSettingsType,
  Weekday,
} from '../types/BusinessHours'
import {
  appointmentIntervals,
  hasBusinessHoursErrors,
  validateBusinessHours,
  weekdayLabels,
} from '../utils/businessHours'
import { Toast } from './Toast'

interface BusinessHoursSettingsProps {
  initialSettings: BusinessHoursSettingsType
}

export function BusinessHoursSettings({
  initialSettings,
}: BusinessHoursSettingsProps) {
  const [settings, setSettings] =
    useState<BusinessHoursSettingsType>(initialSettings)
  const [errors, setErrors] = useState<BusinessHoursErrors>({})
  const [toastMessage, setToastMessage] = useState('')
  const [isToastVisible, setIsToastVisible] = useState(false)

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
  }

  function updateAppointmentInterval(value: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      appointmentInterval: Number(value) as AppointmentInterval,
    }))
    setIsToastVisible(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateBusinessHours(settings)
    setErrors(validationErrors)

    if (hasBusinessHoursErrors(validationErrors)) {
      setIsToastVisible(false)
      return
    }

    setToastMessage('Horarios del consultorio actualizados.')
    setIsToastVisible(true)
  }

  return (
    <section
      className="settings-panel business-hours-panel"
      aria-labelledby="business-hours-title"
    >
      <form className="business-hours-form" onSubmit={handleSubmit}>
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

        <aside
          className="business-calendar-note"
          aria-labelledby="calendar-exceptions-title"
        >
          <h3 id="calendar-exceptions-title">Excepciones del calendario</h3>
          <p>
            Más adelante podrás definir feriados, cierres especiales o días con
            horario distinto.
          </p>
        </aside>
      </form>

      <Toast
        message={toastMessage}
        tone="success"
        visible={isToastVisible}
      />
    </section>
  )
}
