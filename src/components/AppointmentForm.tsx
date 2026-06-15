import { useMemo, useState, type FormEvent } from 'react'
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
  patients: Patient[]
  treatments: Treatment[]
  onCancel: () => void
  onCreateAppointment: (values: AppointmentFormValues) => void
}

export function AppointmentForm({
  appointments,
  businessHours,
  calendarExceptions,
  patients,
  treatments,
  onCancel,
  onCreateAppointment,
}: AppointmentFormProps) {
  const [formValues, setFormValues] =
    useState<AppointmentFormValues>(initialFormValues)
  const [errors, setErrors] = useState<AppointmentFormErrors>({})
  const [patientSearch, setPatientSearch] = useState('')

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

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

    onCreateAppointment({
      ...formValues,
      patient: formValues.patient.trim(),
      treatment: formValues.treatment.trim(),
    })
    setFormValues(initialFormValues)
    setPatientSearch('')
    setErrors({})
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
          Registra una atencion programada usando los pacientes mock actuales.
        </p>
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        <div className="appointment-field patient-picker">
          <label htmlFor="appointment-patient">Paciente</label>
          <div className="appointment-control">
            <input
              id="appointment-patient"
              name="dayia-appointment-patient-search"
              type="search"
              autoComplete="off"
              placeholder="Buscar por nombre o telefono"
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

          <div className="appointment-message-slot">
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
          <div className="appointment-message-slot">
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
            id="appointment-date"
            type="date"
            min={minAppointmentDate}
            value={formValues.date}
            onChange={(event) => updateAppointmentDate(event.target.value)}
          />
          <div className="appointment-message-slot">
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
          <div className="appointment-message-slot">
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
          <div className="appointment-message-slot">
            {activeTreatments.length === 0 ? (
              <p className="field-message field-message--error">
                Activa al menos un tratamiento en Configuracion.
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
          <button className="primary-action" type="submit">
            Guardar cita
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>
            Ver agenda
          </button>
        </div>
      </form>
    </section>
  )
}
