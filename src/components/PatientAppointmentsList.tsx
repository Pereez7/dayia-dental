import type { Appointment } from '../types/Appointment'
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface PatientAppointmentsListProps {
  appointments: Appointment[]
}

export function PatientAppointmentsList({
  appointments,
}: PatientAppointmentsListProps) {
  if (appointments.length === 0) {
    return (
      <p className="dashboard-empty-state">
        Este paciente aun no tiene citas registradas.
      </p>
    )
  }

  return (
    <div className="patient-appointment-list">
      {appointments.map((appointment) => (
        <article className="patient-appointment-row" key={appointment.id}>
          <time dateTime={`${appointment.date}T${appointment.time}`}>
            <strong>{formatAppointmentTime(appointment.time)}</strong>
            <span>{formatAppointmentDate(appointment.date)}</span>
          </time>

          <div>
            <h3>{appointment.treatment}</h3>
            <p>{appointment.patient}</p>
          </div>

          <span
            className={`dashboard-status ${getAppointmentStatusClassName(
              appointment.status,
            )}`}
          >
            {getAppointmentStatusLabel(appointment.status)}
          </span>
        </article>
      ))}
    </div>
  )
}
