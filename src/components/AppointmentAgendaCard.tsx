import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import { getAppointmentStatusActions } from '../utils/appointmentActions'
import {
  formatAppointmentTime,
  getAppointmentStatusClassName,
  getAppointmentStatusLabel,
} from '../utils/appointmentFormatters'

interface AppointmentAgendaCardProps {
  appointment: Appointment
  onCancel: () => void
  onConfirm: () => void
  patient?: Patient
}

export function AppointmentAgendaCard({
  appointment,
  onCancel,
  onConfirm,
  patient,
}: AppointmentAgendaCardProps) {
  const appointmentTime = formatAppointmentTime(appointment.time)
  const statusClassName = getAppointmentStatusClassName(appointment.status)
  const statusLabel = getAppointmentStatusLabel(appointment.status)
  const availableActions = getAppointmentStatusActions(appointment.status)

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

        {availableActions.length > 0 && (
          <div className="agenda-card-actions" aria-label="Acciones de cita">
            {availableActions.includes('confirm') && (
              <button
                className="agenda-card-action agenda-card-action--confirm"
                type="button"
                onClick={onConfirm}
              >
                Confirmar
              </button>
            )}
            {availableActions.includes('cancel') && (
              <button
                className="agenda-card-action agenda-card-action--cancel"
                type="button"
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
