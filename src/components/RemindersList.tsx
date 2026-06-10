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
            {dateGroup.appointmentGroups.map((appointmentGroup) => {
              const hasPhone =
                appointmentGroup.phone !== 'Sin telefono registrado'

              return (
                <article
                  className="reminder-card"
                  key={appointmentGroup.appointmentId}
                >
                    <div className="reminder-card-main">
                      <div className="reminder-card-patient">
                        <h4>{appointmentGroup.patientName}</h4>
                        <p
                          className={
                            hasPhone
                              ? 'reminder-phone'
                              : 'reminder-phone reminder-phone--missing'
                          }
                        >
                          {appointmentGroup.phone}
                        </p>
                        {!hasPhone && (
                          <p className="reminder-phone-note">
                            Sin teléfono registrado. No se podrá enviar por WhatsApp.
                          </p>
                        )}
                      </div>

                      <div className="reminder-appointment-time">
                        <strong>{appointmentGroup.appointmentTime}</strong>
                        <span>{appointmentGroup.treatment}</span>
                      </div>
                    </div>

                    {appointmentGroup.omittedReminderNotes.length > 0 && (
                      <div className="reminder-omission-notes">
                        {appointmentGroup.omittedReminderNotes.map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                    )}

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
                                <span>Tipo</span>
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
                                className="soft-action reminder-action-secondary"
                                type="button"
                                disabled={!hasPhone}
                                title={
                                  hasPhone
                                    ? undefined
                                    : 'Agrega un teléfono para simular el envío.'
                                }
                                onClick={() => onMarkSent(reminder.id)}
                              >
                                Marcar enviado
                              </button>
                              <button
                                className="soft-action reminder-action-danger"
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
              )
            })}
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
