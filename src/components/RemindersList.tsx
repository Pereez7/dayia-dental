import type { ReminderDateGroup } from '../types/Reminder'
import {
  getReminderStatusClassName,
  getReminderStatusLabel,
  getReminderTypeLabel,
} from '../utils/reminders'

interface RemindersListProps {
  emptyMessage: string
  dateGroups: ReminderDateGroup[]
  selectedReminderId: string | null
  onMarkFailed: (reminderId: string) => void
  onMarkSent: (reminderId: string) => void
  onSelectReminder: (reminderId: string) => void
}

export function RemindersList({
  dateGroups,
  emptyMessage,
  selectedReminderId,
  onMarkFailed,
  onMarkSent,
  onSelectReminder,
}: RemindersListProps) {
  if (dateGroups.length === 0) {
    return (
      <p className="dashboard-empty-state">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="reminder-list">
      {dateGroups.map((dateGroup) => (
        <section className="reminder-date-group" key={dateGroup.appointmentDate}>
          <h3>{dateGroup.label}</h3>

          <div className="reminder-appointment-list">
            {dateGroup.appointmentGroups.map((appointmentGroup) => (
              <article
                className="reminder-card"
                key={appointmentGroup.appointmentId}
              >
                <div className="reminder-card-main">
                  <div>
                    <h4>{appointmentGroup.patientName}</h4>
                    <p
                      className={
                        appointmentGroup.phone === 'Sin telefono registrado'
                          ? 'reminder-phone reminder-phone--missing'
                          : 'reminder-phone'
                      }
                    >
                      {appointmentGroup.phone}
                    </p>
                  </div>

                  <div className="reminder-appointment-time">
                    <strong>{appointmentGroup.appointmentTime}</strong>
                    <span>{appointmentGroup.treatment}</span>
                  </div>
                </div>

                <div className="reminder-row-list">
                  {appointmentGroup.reminders.map((reminder) => {
                    const isSelected = reminder.id === selectedReminderId
                    const statusClassName = getReminderStatusClassName(
                      reminder.status,
                    )

                    return (
                      <div
                        className={`reminder-row${
                          isSelected ? ' reminder-row--selected' : ''
                        }`}
                        key={reminder.id}
                      >
                        <div className="reminder-row-meta">
                          <div>
                            <span>Recordatorio</span>
                            <strong>
                              {getReminderTypeLabel(reminder.reminderType)}
                            </strong>
                          </div>
                          <div>
                            <span>Programado para</span>
                            <strong>
                              {formatReminderDateTime(reminder.scheduledFor)}
                            </strong>
                          </div>
                        </div>

                        <span className={`reminder-status ${statusClassName}`}>
                          {getReminderStatusLabel(reminder.status)}
                        </span>

                        <div className="reminder-actions">
                          <button
                            className="secondary-action"
                            type="button"
                            onClick={() => onSelectReminder(reminder.id)}
                          >
                            Ver mensaje
                          </button>
                          <button
                            className="success-action"
                            type="button"
                            onClick={() => onMarkSent(reminder.id)}
                          >
                            Marcar enviado
                          </button>
                          <button
                            className="danger-action"
                            type="button"
                            onClick={() => onMarkFailed(reminder.id)}
                          >
                            Marcar fallido
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function formatReminderDateTime(value: string) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))

  return formattedDate.replace(/\s/g, ' ')
}
