import type { Reminder } from '../types/Reminder'
import type { AppointmentId } from '../types/Appointment'
import { isAppointmentDateTimePast } from '../utils/reminderExpiration'
import {
  getReminderDateGroupLabel,
  getReminderStatusClassName,
  getReminderTypeLabel,
} from '../utils/reminders'
import {
  getReminderAppointmentStateText,
  getReminderStateText,
} from '../utils/reminderView'

interface ReminderMessagePreviewProps {
  canResolveAppointment?: boolean
  onResolveAppointment?: (appointmentId: AppointmentId) => void
  reminder: Reminder | undefined
}

export function ReminderMessagePreview({
  canResolveAppointment = true,
  onResolveAppointment,
  reminder,
}: ReminderMessagePreviewProps) {
  if (!reminder) {
    return (
      <aside className="reminder-message-panel">
        <div className="section-heading">
          <h2>Vista previa</h2>
        </div>
        <div className="reminder-preview-empty">
          <strong>Selecciona un recordatorio para ver el mensaje.</strong>
          <span>La vista previa mostrará el texto y los datos de la cita.</span>
        </div>
      </aside>
    )
  }

  const isPastUnresolvedAppointment =
    isAppointmentDateTimePast(
      reminder.appointmentDate,
      reminder.appointmentTime,
    ) &&
    (reminder.appointmentStatus === 'pending' ||
      reminder.appointmentStatus === 'confirmed' ||
      reminder.appointmentStatus === 'rescheduled')

  return (
    <aside className="reminder-message-panel">
      <div className="reminder-preview-heading">
        <div className="section-heading">
          <h2>Vista previa</h2>
          <p className="section-description">
            Mensaje listo para revisión manual.
          </p>
        </div>
        <span
          className={`reminder-status ${getReminderStatusClassName(reminder.status)}`}
        >
          {getReminderStateText(reminder.status)}
        </span>
      </div>

      <dl className="reminder-preview-details">
        <div>
          <dt>Paciente</dt>
          <dd>{reminder.patientName}</dd>
        </div>
        <div>
          <dt>Cita</dt>
          <dd>
            <time
              dateTime={`${reminder.appointmentDate}T${reminder.appointmentTime}`}
            >
              {getReminderDateGroupLabel(reminder.appointmentDate)},{' '}
              {reminder.appointmentTime}
            </time>
          </dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{getReminderTypeLabel(reminder.reminderType)}</dd>
        </div>
        <div>
          <dt>Tratamiento</dt>
          <dd>{reminder.treatment}</dd>
        </div>
        <div>
          <dt>Estado del recordatorio</dt>
          <dd>{getReminderStateText(reminder.status)}</dd>
        </div>
        <div>
          <dt>Estado de la cita</dt>
          <dd>{getReminderAppointmentStateText(reminder.appointmentStatus)}</dd>
        </div>
        {reminder.statusNote && (
          <div>
            <dt>Motivo</dt>
            <dd>{reminder.statusNote}</dd>
          </div>
        )}
      </dl>

      <p className="reminder-preview-label">Mensaje final</p>
      <blockquote className="reminder-message-preview">
        {reminder.message}
      </blockquote>
      <p className="reminder-note">
        {reminder.statusNote
          ? 'Este recordatorio ya no requiere una acción de envío.'
          : reminder.status === 'cancelled'
            ? 'Recordatorio cancelado junto con la cita.'
            : 'Envío manual preparado. Todavía no hay envío automático por WhatsApp API.'}
      </p>
      {isPastUnresolvedAppointment && canResolveAppointment && (
        <div className="reminder-preview-resolution">
          <div>
            <strong>Cita pasada sin cierre.</strong>
            <span>Resuelve la cita sin reactivar este recordatorio.</span>
          </div>
          {onResolveAppointment && canResolveAppointment && (
            <button
              className="primary-action"
              type="button"
              onClick={() => onResolveAppointment(reminder.appointmentId)}
            >
              Resolver cita
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
