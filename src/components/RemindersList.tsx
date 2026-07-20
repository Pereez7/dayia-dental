import type { ReminderDateGroup } from '../types/Reminder'
import { getAppointmentStatusLabel } from '../utils/appointmentFormatters'
import { isAppointmentDateTimePast } from '../utils/reminderExpiration'
import {
  buildWhatsAppReminderUrl,
  canMarkReminderAsSent,
  formatReminderScheduledDateTime,
  getReminderStatusClassName,
  getReminderTypeLabel,
} from '../utils/reminders'
import { getReminderStateText } from '../utils/reminderView'

interface RemindersListProps {
  emptyDescription: string
  emptyMessage: string
  dateGroups: ReminderDateGroup[]
  selectedReminderId: string | null
  onMarkFailed: (reminderId: string) => void
  onMarkSent: (reminderId: string) => void
  canResolveAppointment?: (
    appointmentId: ReminderDateGroup['appointmentGroups'][number]['appointmentId'],
    appointmentDate: string,
    appointmentTime: string,
  ) => boolean
  onResolveAppointment?: (appointmentId: ReminderDateGroup['appointmentGroups'][number]['appointmentId']) => void
  onSelectReminder: (reminderId: string) => void
  pendingAction?: {
    reminderId: string
    status: 'failed' | 'sent'
  } | null
}

export function RemindersList({
  dateGroups,
  emptyDescription,
  emptyMessage,
  selectedReminderId,
  onMarkFailed,
  onMarkSent,
  canResolveAppointment,
  onResolveAppointment,
  onSelectReminder,
  pendingAction = null,
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
              const reminderStatuses = Array.from(
                new Set(
                  appointmentGroup.reminders.map((reminder) => reminder.status),
                ),
              )
              const isPastAppointment = isAppointmentDateTimePast(
                appointmentGroup.appointmentDate,
                appointmentGroup.appointmentTime,
              )
              const isPastUnresolvedAppointment =
                isPastAppointment &&
                (appointmentGroup.appointmentStatus === 'pending' ||
                  appointmentGroup.appointmentStatus === 'confirmed' ||
                  appointmentGroup.appointmentStatus === 'rescheduled')
              const canResolveCurrentOccurrence =
                isPastUnresolvedAppointment &&
                (canResolveAppointment?.(
                  appointmentGroup.appointmentId,
                  appointmentGroup.appointmentDate,
                  appointmentGroup.appointmentTime,
                ) ?? true)

              return (
                <article
                  className="reminder-card"
                  key={`${appointmentGroup.appointmentId}-${appointmentGroup.appointmentDate}-${appointmentGroup.appointmentTime}`}
                >
                  <div className="reminder-card-main">
                    <div className="reminder-card-patient">
                      <div className="reminder-card-title">
                        <h4>{appointmentGroup.patientName}</h4>
                        <div className="reminder-card-statuses">
                          {reminderStatuses.map((status) => (
                            <span
                              className={`reminder-status ${getReminderStatusClassName(status)}`}
                              key={status}
                            >
                              {getReminderStateText(status)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="reminder-appointment-state">
                        Cita: {getAppointmentStatusLabel(
                          appointmentGroup.appointmentStatus,
                        )}
                      </p>
                      {canResolveCurrentOccurrence && (
                        <div className="reminder-resolution-callout">
                          <p className="reminder-past-appointment-note">
                            Cita pasada sin cierre.
                          </p>
                          {onResolveAppointment && canResolveCurrentOccurrence && (
                            <button
                              className="primary-action"
                              type="button"
                              onClick={() =>
                                onResolveAppointment(
                                  appointmentGroup.appointmentId,
                                )
                              }
                            >
                              Resolver cita
                            </button>
                          )}
                        </div>
                      )}
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
                      <small>
                        {appointmentGroup.reminders.length}{' '}
                        {appointmentGroup.reminders.length === 1
                          ? 'recordatorio'
                          : 'recordatorios'}
                      </small>
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
                      const canRunManualActions =
                        !isPastAppointment &&
                        (reminder.status === 'pending' ||
                          reminder.status === 'scheduled')
                      const statusClassName = getReminderStatusClassName(
                        reminder.status,
                      )
                      const whatsappUrl = buildWhatsAppReminderUrl(
                        reminder.phone,
                        reminder.message,
                      )
                      const isUpdating =
                        pendingAction?.reminderId === reminder.id

                      return (
                        <div
                          aria-current={isSelected ? 'true' : undefined}
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
                              <span>
                                {reminder.reminderType === 'immediate'
                                  ? 'Modalidad'
                                  : 'Programado para'}
                              </span>
                              <strong>
                                {reminder.reminderType === 'immediate'
                                  ? 'Envío manual, sin programación'
                                  : formatReminderScheduledDateTime(
                                      reminder.scheduledFor,
                                    )}
                              </strong>
                            </div>
                          </div>

                          <div className="reminder-status-stack">
                            <span
                              className={`reminder-status ${statusClassName}`}
                            >
                              {getReminderStateText(
                                reminder.status,
                                reminder.reminderType,
                              )}
                            </span>
                            {reminder.statusNote && (
                              <p className="reminder-status-note">
                                {reminder.statusNote}
                              </p>
                            )}
                          </div>

                          <div className="reminder-actions">
                            <button
                              className="secondary-action"
                              type="button"
                              onClick={() => onSelectReminder(reminder.id)}
                            >
                              Ver mensaje
                            </button>
                            {canRunManualActions && (
                              <>
                                {whatsappUrl ? (
                                  <a
                                    aria-label={`Abrir WhatsApp para ${reminder.patientName}`}
                                    className="success-action reminder-action-whatsapp"
                                    href={whatsappUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    Abrir WhatsApp
                                  </a>
                                ) : (
                                  <button
                                    className="success-action reminder-action-whatsapp"
                                    disabled
                                    title="Agrega un teléfono para abrir WhatsApp."
                                    type="button"
                                  >
                                    Abrir WhatsApp
                                  </button>
                                )}
                                <button
                                  className="soft-action reminder-action-secondary"
                                  type="button"
                                  disabled={!hasPhone || Boolean(pendingAction)}
                                  title={
                                    hasPhone
                                      ? 'Registra el resultado después de enviar el mensaje.'
                                      : 'Agrega un teléfono para registrar el envío.'
                                  }
                                  onClick={() => onMarkSent(reminder.id)}
                                >
                                  {isUpdating && pendingAction.status === 'sent'
                                    ? 'Guardando...'
                                    : 'Marcar enviado'}
                                </button>
                                <button
                                  className="danger-action reminder-action-danger"
                                  type="button"
                                  disabled={Boolean(pendingAction)}
                                  onClick={() => onMarkFailed(reminder.id)}
                                >
                                  {isUpdating && pendingAction.status === 'failed'
                                    ? 'Guardando...'
                                    : 'Marcar fallido'}
                                </button>
                              </>
                            )}
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
