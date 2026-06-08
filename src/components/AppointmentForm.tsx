import { useState, type FormEvent } from 'react'
import type {
  AppointmentFormErrors,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import type { Patient } from '../types/Patient'
import { treatments } from '../data/treatments'
import { getAppointmentStatusLabel } from '../utils/appointmentFormatters'
import { filterPatients } from '../utils/patientFilters'
import {
  appointmentInitialStatuses,
  hasAppointmentFormErrors,
  validateAppointmentForm,
} from '../utils/appointmentValidators'

const initialFormValues: AppointmentFormValues = {
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
  onCancel: () => void
  onCreateAppointment: (values: AppointmentFormValues) => void
}

export function AppointmentForm({
  patients,
  onCancel,
  onCreateAppointment,
}: AppointmentFormProps) {
  const [formValues, setFormValues] =
    useState<AppointmentFormValues>(initialFormValues)
  const [errors, setErrors] = useState<AppointmentFormErrors>({})
  const [patientSearch, setPatientSearch] = useState('')

  const minAppointmentDate = getTodayDateInputValue()
  const filteredPatients = filterPatients(patients, patientSearch).slice(0, 5)

  function updateField(field: keyof AppointmentFormValues, value: string) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function handlePatientSearch(value: string) {
    setPatientSearch(value)
    updateField('patient', '')
  }

  function selectPatient(patient: Patient) {
    setPatientSearch(patient.fullName)
    updateField('patient', patient.fullName)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateAppointmentForm(formValues)
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
        <div className="patient-picker">
          <span>Paciente</span>
          <input
            type="search"
            placeholder="Buscar por nombre o telefono"
            value={patientSearch}
            onChange={(event) => handlePatientSearch(event.target.value)}
          />

          {patientSearch && !formValues.patient && (
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

          <p
            className={`selected-patient${
              formValues.patient ? '' : ' selected-patient--empty'
            }`}
          >
            Paciente seleccionado: {formValues.patient || 'Sin seleccionar'}
          </p>
          {errors.patient && <small>{errors.patient}</small>}
        </div>

        <label>
          <span>Estado inicial</span>
          <select
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
          {errors.status && <small>{errors.status}</small>}
        </label>

        <label>
          <span>Fecha</span>
          <input
            type="date"
            min={minAppointmentDate}
            value={formValues.date}
            onChange={(event) => updateField('date', event.target.value)}
          />
          {errors.date && <small>{errors.date}</small>}
        </label>

        <label>
          <span>Hora</span>
          <input
            type="time"
            value={formValues.time}
            onChange={(event) => updateField('time', event.target.value)}
          />
          {errors.time && <small>{errors.time}</small>}
        </label>

        <label className="appointment-form-full">
          <span>Motivo o tratamiento</span>
          <select
            value={formValues.treatment}
            onChange={(event) => updateField('treatment', event.target.value)}
          >
            <option value="">Seleccionar tratamiento</option>
            {treatments.map((treatment) => (
              <option key={treatment} value={treatment}>
                {treatment}
              </option>
            ))}
          </select>
          {errors.treatment && <small>{errors.treatment}</small>}
        </label>

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
