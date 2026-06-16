import type { AppointmentStatus } from '../types/Appointment'
import type { ReminderDateGroup } from '../types/Reminder'
import {
  buildWhatsAppReminderUrl,
  canMarkReminderAsSent,
  formatReminderScheduledDateTime,
  getReminderStatusClassName,
  getReminderStatusLabel,
  getReminderTypeLabel,
} from '../utils/reminders'

interface RemindersListProps {
  emptyDescription: string
  emptyMessage: string
  dateGroups: ReminderDateGroup[]
  selectedReminderId: string | null
  onMarkFailed: (reminderId: string) => void
  onMarkSent: (reminderId: string) => void
  onSelectReminder: (reminderId: string) => void
}

export function RemindersList({
  dateGroups,
  emptyDescription,
  emptyMessage,
  selectedReminderId,
  onMarkFailed,
  onMarkSent,
  onSelectReminder,
}: RemindersListProps) {
  if (dateGroups.length === 0) {
    return (
      <div className="dashboard-empty-state reminder-empty-state">
        <strong>{emptyMessage}</strong>
        <span>{emptyDescription}</span>
      </div>
    )
  }

  return (
    <div className="reminder-list">
      {dateGroups.map((dateGroup) => (
        <section className="reminder-date-group" key={dateGroup.appointmentDate}>
          <h3>{dateGroup.label}</h3>

          <div className="reminder-appointment-list">
            {dateGroup.appointmentGroups.map((appointmentGroup) => {
              const hasPhone = canMarkReminderAsSent(
                appointmentGroup.reminders[0],
              )
              const reasonText =
                appointmentGroup.rescheduleReasonDetail ||
                appointmentGroup.rescheduleReason

              return (
                <article
                  className={`reminder-card reminder-card--${appointmentGroup.appointmentStatus}`}
                  key={appointmentGroup.appointmentId}
                >
                  <div className="reminder-card-main">
                    <div className="reminder-card-patient">
                      <div className="reminder-card-title">
                        <h4>{appointmentGroup.patientName}</h4>
                        <span
                          className={`appointment-status appointment-status--${appointmentGroup.appointmentStatus}`}
                        >
                          {getAppointmentStatusLabel(
                            appointmentGroup.appointmentStatus,
                          )}
                        </span>
                      </div>
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
                      {appointmentGroup.appointmentStatus === 'rescheduled' &&
                        reasonText && (
                          <p className="reminder-reason-note">
                            Reprogramada: {reasonText}
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
                                {formatReminderScheduledDateTime(
                                  reminder.scheduledFor,
                                )}
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
                            {buildWhatsAppReminderUrl(
                              reminder.phone,
                              reminder.message,
                            ) ? (
                              <a
                                className="soft-action reminder-action-secondary"
                                href={buildWhatsAppReminderUrl(
                                  reminder.phone,
                                  reminder.message,
                                )}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Abrir WhatsApp
                              </a>
                            ) : (
                              <button
                                className="soft-action reminder-action-secondary"
                                disabled
                                title="Agrega un teléfono para abrir WhatsApp."
                                type="button"
                              >
                                Abrir WhatsApp
                              </button>
                            )}
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

function getAppointmentStatusLabel(
  appointmentStatus: AppointmentStatus,
) {
  const labels: Record<AppointmentStatus, string> = {
    cancelled: 'Cancelada',
    completed: 'Completada',
    confirmed: 'Confirmada',
    pending: 'Pendiente',
    rescheduled: 'Reprogramada',
  }

  return labels[appointmentStatus]
}
