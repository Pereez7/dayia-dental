import { useMemo, useState } from 'react'
import { ReminderKpiCard } from '../components/ReminderKpiCard'
import { ReminderMessagePreview } from '../components/ReminderMessagePreview'
import { RemindersList } from '../components/RemindersList'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type { ReminderStatus, ReminderStatusFilter } from '../types/Reminder'
import {
  filterRemindersByStatus,
  generateAppointmentReminders,
  getReminderStatusLabel,
  groupRemindersByAppointmentDate,
  summarizeRemindersByStatus,
} from '../utils/reminders'

interface WhatsAppRemindersViewProps {
  appointments: Appointment[]
  patients: Patient[]
}

export function WhatsAppRemindersView({
  appointments,
  patients,
}: WhatsAppRemindersViewProps) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ReminderStatus>
  >({})
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(
    null,
  )
  const [statusFilter, setStatusFilter] =
    useState<ReminderStatusFilter>('all')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const generatedReminders = useMemo(
    () => generateAppointmentReminders(appointments, patients),
    [appointments, patients],
  )
  const reminders = generatedReminders.map((reminder) => ({
    ...reminder,
    status: statusOverrides[reminder.id] ?? reminder.status,
  }))
  const summary = summarizeRemindersByStatus(reminders)
  const filteredReminders = filterRemindersByStatus(reminders, statusFilter)
  const reminderDateGroups =
    groupRemindersByAppointmentDate(filteredReminders)
  const selectedReminder =
    filteredReminders.find((reminder) => reminder.id === selectedReminderId) ??
    filteredReminders[0] ??
    reminders[0]
  const emptyListMessage =
    reminders.length === 0
      ? 'No hay recordatorios pendientes porque no existen citas futuras.'
      : 'No hay recordatorios para este filtro.'

  function updateReminderStatus(reminderId: string, status: ReminderStatus) {
    setStatusOverrides((currentOverrides) => ({
      ...currentOverrides,
      [reminderId]: status,
    }))
    setSelectedReminderId(reminderId)
    setFeedbackMessage(
      status === 'sent'
        ? 'Recordatorio marcado como enviado.'
        : 'Recordatorio marcado como fallido.',
    )
  }

  return (
    <section className="reminders-view" aria-label="Recordatorios WhatsApp mock">
      <section className="reminder-kpi-panel" aria-label="Resumen de recordatorios">
        <div className="section-heading">
          <p className="eyebrow">Recordatorios</p>
          <h2>Recordatorios de citas</h2>
          <p className="section-description">
            Prepara y controla los mensajes de confirmacion para tus pacientes.
          </p>
          <p className="reminder-simulation-note">
            Simulacion local: todavia no se envian mensajes reales por WhatsApp.
          </p>
        </div>

        <div className="reminder-kpi-grid">
          <ReminderKpiCard
            label="Todos"
            tone="slate"
            value={reminders.length}
          />
          <ReminderKpiCard
            label="Pendientes"
            tone="amber"
            value={summary.pending}
          />
          <ReminderKpiCard
            label="Programados"
            tone="blue"
            value={summary.scheduled}
          />
          <ReminderKpiCard
            label="Enviados simulados"
            tone="green"
            value={summary.sent}
          />
          <ReminderKpiCard
            label="Fallidos"
            tone="red"
            value={summary.failed}
          />
        </div>
      </section>

      {feedbackMessage && (
        <p className="settings-feedback settings-feedback--success" role="status">
          {feedbackMessage}
        </p>
      )}

      <section className="reminders-layout">
        <article className="reminders-panel">
          <div className="section-heading">
            <p className="eyebrow">Cola local</p>
            <h2>Citas con recordatorios</h2>
          </div>

          <div className="reminder-filter-bar" aria-label="Filtrar recordatorios">
            {getReminderFilters().map((filter) => (
              <button
                aria-pressed={statusFilter === filter}
                className="reminder-filter"
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter)
                  setFeedbackMessage('')
                }}
              >
                {filter === 'all'
                  ? `Todos (${reminders.length})`
                  : `${getReminderStatusLabel(filter)} (${summary[filter]})`}
              </button>
            ))}
          </div>

          <RemindersList
            dateGroups={reminderDateGroups}
            emptyMessage={emptyListMessage}
            selectedReminderId={selectedReminder?.id ?? null}
            onMarkFailed={(reminderId) =>
              updateReminderStatus(reminderId, 'failed')
            }
            onMarkSent={(reminderId) =>
              updateReminderStatus(reminderId, 'sent')
            }
            onSelectReminder={(reminderId) => {
              setSelectedReminderId(reminderId)
              setFeedbackMessage('')
            }}
          />
        </article>

        <ReminderMessagePreview reminder={selectedReminder} />
      </section>
    </section>
  )
}

function getReminderFilters(): ReminderStatusFilter[] {
  return ['all', 'pending', 'scheduled', 'sent', 'failed']
}
