import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface AppointmentAgendaCardProps {
  appointment: Appointment
  patient?: Patient
}

export function AppointmentAgendaCard({
  appointment,
  patient,
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
          <p>{patient?.phone ?? 'Telefono sin registro'}</p>
        </div>
        <p className="agenda-card-treatment">{appointment.treatment}</p>
        <span className={`agenda-status ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
    </article>
  )
}
