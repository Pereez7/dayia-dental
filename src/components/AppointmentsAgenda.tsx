import { useMemo, useState } from 'react'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getAppointmentsForDate,
  getDateInputValue,
  getVisibleAgendaDays,
  summarizeAppointmentsByStatus,
} from '../utils/appointmentGroups'
import { AppointmentAgendaCard } from './AppointmentAgendaCard'

interface AppointmentsAgendaProps {
  appointments: Appointment[]
  patients: Patient[]
}

export function AppointmentsAgenda({
  appointments,
  patients,
}: AppointmentsAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue())
  const visibleDays = useMemo(
    () => getVisibleAgendaDays(appointments),
    [appointments],
  )
  const selectedAppointments = useMemo(
    () => getAppointmentsForDate(appointments, selectedDate),
    [appointments, selectedDate],
  )
  const statusSummary = summarizeAppointmentsByStatus(selectedAppointments)

  function getAppointmentPatient(appointment: Appointment) {
    if (appointment.patientId !== undefined) {
      return patients.find((patient) => patient.id === appointment.patientId)
    }

    return patients.find((patient) => patient.fullName === appointment.patient)
  }

  return (
    <section className="agenda-section" aria-label="Agenda de citas">
      <div className="agenda-header">
        <div className="section-heading">
          <p className="eyebrow">Agenda diaria</p>
          <h2>Citas del consultorio</h2>
          <p className="section-description">
            Revisa la operacion de un dia y las citas programadas por hora.
          </p>
        </div>
      </div>

      <div className="agenda-date-nav" aria-label="Seleccionar dia de agenda">
        {visibleDays.map((day) => (
          <button
            key={day.date}
            type="button"
            className="agenda-date-tab"
            aria-pressed={day.date === selectedDate}
            onClick={() => setSelectedDate(day.date)}
          >
            <span>{day.primaryLabel}</span>
            <strong>{day.secondaryLabel}</strong>
          </button>
        ))}
      </div>

      <div className="agenda-summary">
        <div className="agenda-kpi agenda-kpi--total">
          <strong>{selectedAppointments.length}</strong>
          <span>Total</span>
        </div>
        <div className="agenda-kpi agenda-kpi--pending">
          <strong>{statusSummary.pending}</strong>
          <span>Pendientes</span>
        </div>
        <div className="agenda-kpi agenda-kpi--confirmed">
          <strong>{statusSummary.confirmed}</strong>
          <span>Confirmadas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--rescheduled">
          <strong>{statusSummary.rescheduled}</strong>
          <span>Reprogramadas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--cancelled">
          <strong>{statusSummary.cancelled}</strong>
          <span>Canceladas</span>
        </div>
      </div>

      {selectedAppointments.length > 0 ? (
        <div className="agenda-list" aria-label="Citas del dia seleccionado">
          {selectedAppointments.map((appointment) => (
            <AppointmentAgendaCard
              appointment={appointment}
              key={appointment.id}
              patient={getAppointmentPatient(appointment)}
            />
          ))}
        </div>
      ) : (
        <div className="agenda-empty-state">
          <h3>No hay citas programadas para este dia.</h3>
          <p>Puedes registrar una nueva cita desde el boton + Cita.</p>
        </div>
      )}
    </section>
  )
}
