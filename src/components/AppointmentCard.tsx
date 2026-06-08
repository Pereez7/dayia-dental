import type { Appointment } from '../types/Appointment'
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface AppointmentCardProps {
  appointment: Appointment
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const appointmentDate = formatAppointmentDate(appointment.date)
  const appointmentTime = formatAppointmentTime(appointment.time)
  const statusClassName = getAppointmentStatusClassName(appointment.status)
  const statusLabel = getAppointmentStatusLabel(appointment.status)

  return (
    <div className="appointment-item">
      <time dateTime={`${appointment.date}T${appointment.time}`}>
        <span>{appointmentDate}</span>
        <strong>{appointmentTime}</strong>
      </time>
      <div>
        <strong>{appointment.patient}</strong>
        <span>{appointment.treatment}</span>
      </div>
      <span className={`status-pill ${statusClassName}`}>{statusLabel}</span>
    </div>
  )
}
