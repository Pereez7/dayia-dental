import { useState, type FormEvent } from 'react'
import type {
  AppointmentFormErrors,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type { Treatment } from '../types/Treatment'
import { getAppointmentStatusLabel } from '../utils/appointmentFormatters'
import { appointmentTimeSlots } from '../utils/appointmentTimeSlots'
import { filterPatients } from '../utils/patientFilters'
import { getActiveTreatments } from '../utils/treatmentUtils'
import {
  appointmentInitialStatuses,
  hasAppointmentFormErrors,
  validateAppointmentForm,
} from '../utils/appointmentValidators'

const initialFormValues: AppointmentFormValues = {
  patientId: null,
  patient: '',
  date: '',
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
  patients: Patient[]
  treatments: Treatment[]
  onCancel: () => void
  onCreateAppointment: (values: AppointmentFormValues) => void
}

export function AppointmentForm({
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

  function updateField(field: keyof AppointmentFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function handlePatientSearch(value: string) {
    setPatientSearch(value)
    setFormValues((currentValues) => ({
      ...currentValues,
      patientId: null,
      patient: '',
    }))
  }

  function selectPatient(patient: Patient) {
    setPatientSearch(patient.fullName)
    setFormValues((currentValues) => ({
      ...currentValues,
      patientId: patient.id,
      patient: patient.fullName,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      patient: undefined,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateAppointmentForm(
      formValues,
      new Date(),
      activeTreatments,
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
              type="search"
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
            onChange={(event) => updateField('date', event.target.value)}
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
            value={formValues.time}
            onChange={(event) => updateField('time', event.target.value)}
          >
            <option value="">Seleccionar horario</option>
            {appointmentTimeSlots.map((slot) => (
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
          </div>
        </div>

        <div className="appointment-field appointment-form-full">
          <label htmlFor="appointment-treatment">Motivo o tratamiento</label>
          <select
            id="appointment-treatment"
            value={formValues.treatment}
            onChange={(event) => updateField('treatment', event.target.value)}
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
