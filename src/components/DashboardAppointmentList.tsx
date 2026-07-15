import type { Appointment } from '../types/Appointment'
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface DashboardAppointmentListProps {
  appointments: Appointment[]
}

export function DashboardAppointmentList({
  appointments,
}: DashboardAppointmentListProps) {
  if (appointments.length === 0) {
    return (
      <p className="dashboard-empty-state">
        No hay próximas atenciones programadas.
      </p>
    )
  }

  return (
    <div className="dashboard-appointment-list">
      {appointments.map((appointment) => (
        <article className="dashboard-appointment-card" key={appointment.id}>
          <time dateTime={`${appointment.date}T${appointment.time}`}>
            <strong>{formatAppointmentTime(appointment.time)}</strong>
            <span>{formatAppointmentDate(appointment.date)}</span>
          </time>

          <div>
            <h3>{appointment.patient}</h3>
            <p>{appointment.treatment}</p>
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
