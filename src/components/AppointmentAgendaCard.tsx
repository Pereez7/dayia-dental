import type { Appointment } from '../types/Appointment'
import {
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface AppointmentAgendaCardProps {
  appointment: Appointment
}

export function AppointmentAgendaCard({
  appointment,
}: AppointmentAgendaCardProps) {
  const appointmentTime = formatAppointmentTime(appointment.time)
  const statusClassName = getAppointmentStatusClassName(appointment.status)
  const statusLabel = getAppointmentStatusLabel(appointment.status)

  return (
    <article className="agenda-card">
      <time
        className="agenda-card-time"
        dateTime={`${appointment.date}T${appointment.time}`}
      >
        {appointmentTime}
      </time>

      <div className="agenda-card-body">
        <div>
          <h3>{appointment.patient}</h3>
          <p>{appointment.treatment}</p>
        </div>
        <span className={`agenda-status ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
    </article>
  )
}
