import type { Reminder } from '../types/Reminder'
import { getReminderTypeLabel } from '../utils/reminders'

interface ReminderMessagePreviewProps {
  reminder: Reminder | undefined
}

export function ReminderMessagePreview({
  reminder,
}: ReminderMessagePreviewProps) {
  if (!reminder) {
    return (
      <aside className="reminder-message-panel">
        <div className="section-heading">
          <p className="eyebrow">Mensaje</p>
          <h2>Vista previa</h2>
        </div>
        <p className="dashboard-empty-state">
          No hay mensajes sugeridos porque no existen recordatorios disponibles.
        </p>
      </aside>
    )
  }

  return (
    <aside className="reminder-message-panel">
      <div className="section-heading">
        <p className="eyebrow">Mensaje</p>
        <h2>Vista previa</h2>
        <p className="section-description">
          {reminder.patientName} · {reminder.appointmentTime} ·{' '}
          {getReminderTypeLabel(reminder.reminderType)}
        </p>
      </div>

      <blockquote className="reminder-message-preview">
        {reminder.message}
      </blockquote>
      <p className="reminder-note">
        {reminder.statusNote ??
          (reminder.status === 'cancelled'
            ? 'Recordatorio cancelado junto con la cita.'
            : 'Envio manual preparado. Todavia no hay envio automatico por WhatsApp API.')}
      </p>
    </aside>
  )
}
