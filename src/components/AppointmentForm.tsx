import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type {
  Appointment,
  AppointmentFormErrors,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import type { Treatment } from '../types/Treatment'
import { getAppointmentStatusLabel } from '../utils/appointmentFormatters'
import {
  getAvailableTimeOptionsByDuration,
  hasPatientAppointmentOnDate,
} from '../utils/appointmentConflicts'
import {
  getCalendarExceptionForDate,
  getEffectiveBusinessHoursForDate,
} from '../utils/businessHours'
import { filterPatients } from '../utils/patientFilters'
import {
  defaultTreatmentDurationMinutes,
  getActiveTreatments,
  getTreatmentDuration,
} from '../utils/treatmentUtils'
import {
  appointmentInitialStatuses,
  hasAppointmentFormErrors,
  validateAppointmentForm,
} from '../utils/appointmentValidators'
import { Toast } from './Toast'

const initialFormValues: AppointmentFormValues = {
  patientId: null,
  patient: '',
  date: '',
  durationMinutes: defaultTreatmentDurationMinutes,
  time: '',
  treatment: '',
  status: 'pending',
}

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

interface AppointmentFormProps {
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  initialPatient?: Patient
  patients: Patient[]
  treatments: Treatment[]
  onCancel: () => void
  onCreateAppointment: (
    values: AppointmentFormValues,
  ) => Promise<{ error?: string; success: boolean }> | { error?: string; success: boolean } | void
}

export function AppointmentForm({
  appointments,
  businessHours,
  calendarExceptions,
  initialPatient,
  patients,
  treatments,
  onCancel,
  onCreateAppointment,
}: AppointmentFormProps) {
  const submissionLock = useRef(false)
  const [formValues, setFormValues] =
    useState<AppointmentFormValues>(() => ({
      ...initialFormValues,
      patient: initialPatient?.fullName ?? '',
      patientId: initialPatient?.id ?? null,
    }))
  const [errors, setErrors] = useState<AppointmentFormErrors>({})
  const [patientSearch, setPatientSearch] = useState(
    initialPatient?.fullName ?? '',
  )
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(''), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const minAppointmentDate = getTodayDateInputValue()
  const filteredPatients = filterPatients(patients, patientSearch).slice(0, 5)
  const activeTreatments = getActiveTreatments(treatments)
  const selectedTreatmentDuration = formValues.treatment
    ? getTreatmentDuration(activeTreatments, formValues.treatment)
    : null
  const selectedDaySchedule = formValues.date
    ? getEffectiveBusinessHoursForDate(
        businessHours,
        formValues.date,
        calendarExceptions,
      )
    : undefined
  const selectedDateIsClosed =
    Boolean(formValues.date) && selectedDaySchedule?.isOpen === false
  const appointmentTimeOptions = useMemo(
    () =>
      formValues.date
        ? getAvailableTimeOptionsByDuration(
            businessHours,
            appointments,
            formValues.date,
            formValues.durationMinutes,
            {
              calendarExceptions,
              excludePastTimes: true,
              treatments: activeTreatments,
            },
          )
        : [],
    [
      activeTreatments,
      appointments,
      businessHours,
      calendarExceptions,
      formValues.date,
      formValues.durationMinutes,
    ],
  )
  const isTimeSelectDisabled =
    !formValues.date || selectedDateIsClosed || appointmentTimeOptions.length === 0

  function updateField(field: keyof AppointmentFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
  }

  function updateAppointmentDate(value: string) {
    const timeOptions = value
      ? getAvailableTimeOptionsByDuration(
          businessHours,
          appointments,
          value,
          formValues.durationMinutes,
          {
            calendarExceptions,
            excludePastTimes: true,
            treatments: activeTreatments,
          },
        )
      : []
    const daySchedule = value
      ? getEffectiveBusinessHoursForDate(
          businessHours,
          value,
          calendarExceptions,
        )
      : undefined
    const isClosed = Boolean(value) && daySchedule?.isOpen === false
    const calendarException = getCalendarExceptionForDate(
      calendarExceptions,
      value,
    )
    const hasPatientConflict = hasPatientAppointmentOnDate(
      appointments,
      formValues.patientId,
      value,
    )

    setFormValues((currentValues) => ({
      ...currentValues,
      date: value,
      time:
        !isClosed && timeOptions.some((slot) => slot.value === currentValues.time)
          ? currentValues.time
          : '',
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      date: isClosed
        ? calendarException?.type === 'closed'
          ? 'El consultorio está cerrado por excepción ese día.'
          : 'El consultorio está cerrado ese día.'
        : undefined,
      patient: hasPatientConflict
        ? 'Este paciente ya tiene una cita activa ese día.'
        : undefined,
      time: undefined,
    }))
  }

  function updateAppointmentTime(value: string) {
    updateField('time', value)
    setErrors((currentErrors) => ({
      ...currentErrors,
      time: undefined,
    }))
  }

  function updateTreatment(value: string) {
    const durationMinutes = value
      ? getTreatmentDuration(activeTreatments, value)
      : defaultTreatmentDurationMinutes
    const timeOptions = formValues.date
      ? getAvailableTimeOptionsByDuration(
          businessHours,
          appointments,
          formValues.date,
          durationMinutes,
          {
            calendarExceptions,
            excludePastTimes: true,
            treatments: activeTreatments,
          },
        )
      : []

    setFormValues((currentValues) => ({
      ...currentValues,
      durationMinutes,
      time: timeOptions.some((slot) => slot.value === currentValues.time)
        ? currentValues.time
        : '',
      treatment: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      time: undefined,
      treatment: undefined,
    }))
  }

  function handlePatientSearch(value: string) {
    setPatientSearch(value)
    setFormValues((currentValues) => ({
      ...currentValues,
      patientId: null,
      patient: '',
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      patient: undefined,
    }))
  }

  function selectPatient(patient: Patient) {
    const hasPatientConflict = hasPatientAppointmentOnDate(
      appointments,
      patient.id,
      formValues.date,
    )

    setPatientSearch(patient.fullName)
    setFormValues((currentValues) => ({
      ...currentValues,
      patientId: patient.id,
      patient: patient.fullName,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      patient: hasPatientConflict
        ? 'Este paciente ya tiene una cita activa ese día.'
        : undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    setSubmitError('')
    setSuccessMessage('')

    const validationErrors = validateAppointmentForm(
      formValues,
      new Date(),
      activeTreatments,
      businessHours,
      appointments,
      undefined,
      calendarExceptions,
    )
    setErrors(validationErrors)

    if (hasAppointmentFormErrors(validationErrors)) {
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)

    let result: Awaited<ReturnType<typeof onCreateAppointment>>

    try {
      result = await onCreateAppointment({
        ...formValues,
        patient: formValues.patient.trim(),
        treatment: formValues.treatment.trim(),
      })
    } catch {
      result = {
        error: 'No pudimos guardar la cita. Intenta nuevamente.',
        success: false,
      }
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }

    if (result && !result.success) {
      setSubmitError(result.error ?? 'No pudimos guardar la cita.')
      return
    }

    setFormValues(initialFormValues)
    setPatientSearch('')
    setErrors({})
    setSuccessMessage('Cita registrada correctamente.')
  }

  return (
    <section
      className="appointment-form-section"
      aria-labelledby="appointment-form-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Agenda</p>
        <h2 id="appointment-form-title">Nueva cita</h2>
        <p className="section-description">
          Registra una atención usando un paciente y un horario disponible.
        </p>
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        <div className="appointment-field patient-picker">
          <label htmlFor="appointment-patient">Paciente</label>
          <div className="appointment-control">
            <input
              aria-describedby="appointment-patient-message"
              aria-invalid={Boolean(errors.patient)}
              id="appointment-patient"
              name="dayia-appointment-patient-search"
              type="search"
              autoComplete="off"
              placeholder="Buscar por nombre, teléfono o email"
              value={patientSearch}
              onChange={(event) => handlePatientSearch(event.target.value)}
            />

            {patientSearch && formValues.patientId === null && (
              <div className="patient-picker-results">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => selectPatient(patient)}
                    >
                      <strong>{patient.fullName}</strong>
                      <span>{patient.phone}</span>
                    </button>
                  ))
                ) : (
                  <p>No se encontraron pacientes.</p>
                )}
              </div>
            )}
          </div>

          <div
            className="appointment-message-slot"
            id="appointment-patient-message"
          >
            {errors.patient ? (
              <p className="field-message field-message--error">
                {errors.patient}
              </p>
            ) : formValues.patientId !== null ? (
              <p className="field-message field-message--success">
                Paciente seleccionado: {formValues.patient}
              </p>
            ) : (
              <p className="field-message field-message--help">
                Busca y selecciona un paciente.
              </p>
            )}
          </div>
        </div>

        <div className="appointment-field">
          <label htmlFor="appointment-status">Estado inicial</label>
          <select
            aria-describedby="appointment-status-message"
            aria-invalid={Boolean(errors.status)}
            id="appointment-status"
            value={formValues.status}
            onChange={(event) =>
              updateField('status', event.target.value as AppointmentStatus)
            }
          >
            {appointmentInitialStatuses.map((status) => (
              <option key={status} value={status}>
                {getAppointmentStatusLabel(status)}
              </option>
            ))}
          </select>
          <div
            className="appointment-message-slot"
            id="appointment-status-message"
          >
            {errors.status && (
              <p className="field-message field-message--error">
                {errors.status}
              </p>
            )}
          </div>
        </div>

        <div className="appointment-field">
          <label htmlFor="appointment-date">Fecha</label>
          <input
            aria-describedby="appointment-date-message"
            aria-invalid={Boolean(errors.date)}
            id="appointment-date"
            type="date"
            min={minAppointmentDate}
            value={formValues.date}
            onChange={(event) => updateAppointmentDate(event.target.value)}
          />
          <div
            className="appointment-message-slot"
            id="appointment-date-message"
          >
            {errors.date && (
              <p className="field-message field-message--error">
                {errors.date}
              </p>
            )}
          </div>
        </div>

        <div className="appointment-field">
          <label htmlFor="appointment-time">Hora</label>
          <select
            aria-describedby="appointment-time-message"
            aria-invalid={Boolean(errors.time)}
            id="appointment-time"
            disabled={isTimeSelectDisabled}
            value={formValues.time}
            onChange={(event) => updateAppointmentTime(event.target.value)}
          >
            <option value="">
              {selectedDateIsClosed
                ? 'Consultorio cerrado ese día'
                : formValues.date
                  ? appointmentTimeOptions.length > 0
                    ? 'Seleccionar horario'
                    : 'No hay horarios disponibles'
                  : 'Selecciona una fecha'}
            </option>
            {appointmentTimeOptions.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
          <div
            className="appointment-message-slot"
            id="appointment-time-message"
          >
            {errors.time && (
              <p className="field-message field-message--error">
                {errors.time}
              </p>
            )}
            {!errors.time &&
              formValues.date &&
              !selectedDateIsClosed &&
              appointmentTimeOptions.length === 0 && (
                <p className="field-message field-message--help">
                  No hay horarios disponibles para esta fecha.
                </p>
            )}
          </div>
        </div>

        <div className="appointment-field appointment-form-full">
          <label htmlFor="appointment-treatment">Motivo o tratamiento</label>
          <select
            aria-describedby="appointment-treatment-message"
            aria-invalid={Boolean(errors.treatment)}
            id="appointment-treatment"
            value={formValues.treatment}
            onChange={(event) => updateTreatment(event.target.value)}
          >
            <option value="">Seleccionar tratamiento</option>
            {activeTreatments.map((treatment) => (
              <option key={treatment.id} value={treatment.name}>
                {treatment.name}
              </option>
            ))}
          </select>
          <div
            className="appointment-message-slot"
            id="appointment-treatment-message"
          >
            {activeTreatments.length === 0 ? (
              <p className="field-message field-message--error">
                Activa al menos un tratamiento en Configuración.
              </p>
            ) : errors.treatment ? (
              <p className="field-message field-message--error">
                {errors.treatment}
              </p>
            ) : selectedTreatmentDuration ? (
              <p className="field-message field-message--help">
                Duración estimada: {selectedTreatmentDuration} min
              </p>
            ) : null}
          </div>
        </div>

        <div className="form-actions">
          {submitError && (
            <p className="field-message field-message--error" role="alert">
              {submitError}
            </p>
          )}
          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cita'}
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>
            Ver agenda
          </button>
        </div>
      </form>

      <Toast
        message={successMessage}
        tone="success"
        visible={Boolean(successMessage)}
      />
    </section>
  )
}
