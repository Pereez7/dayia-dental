import { useEffect, useMemo, useState } from 'react'
import { ReminderKpiCard } from '../components/ReminderKpiCard'
import { ReminderMessagePreview } from '../components/ReminderMessagePreview'
import { RemindersList } from '../components/RemindersList'
import { Toast } from '../components/Toast'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type {
  Reminder,
  ReminderStatus,
  ReminderStatusFilter,
} from '../types/Reminder'
import {
  canMarkReminderAsSent,
  filterRemindersByAppointmentDate,
  filterRemindersByStatus,
  generateAppointmentReminders,
  getReminderDateOptions,
  getReminderStatusLabel,
  groupRemindersByAppointmentDate,
  summarizeRemindersByStatus,
} from '../utils/reminders'

interface WhatsAppRemindersViewProps {
  appointments: Appointment[]
  errorMessage?: string
  isLoading?: boolean
  patients: Patient[]
  reminders?: Reminder[]
  onMarkReminderFailed?: (
    reminderId: string,
  ) => Promise<ReminderActionResult> | ReminderActionResult
  onMarkReminderSent?: (
    reminderId: string,
  ) => Promise<ReminderActionResult> | ReminderActionResult
}

interface ReminderActionResult {
  error?: string
  success: boolean
}

export function WhatsAppRemindersView({
  appointments,
  errorMessage = '',
  isLoading = false,
  patients,
  reminders: persistedReminders,
  onMarkReminderFailed,
  onMarkReminderSent,
}: WhatsAppRemindersViewProps) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ReminderStatus>
  >({})
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(
    null,
  )
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<
    string | null
  >(null)
  const [statusFilter, setStatusFilter] =
    useState<ReminderStatusFilter>('all')
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<'error' | 'success'>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [actionError, setActionError] = useState('')
  const generatedReminders = useMemo(
    () => generateAppointmentReminders(appointments, patients),
    [appointments, patients],
  )
  const sourceReminders = persistedReminders ?? generatedReminders
  const reminders = useMemo(
    () =>
      sourceReminders.map((reminder) => ({
        ...reminder,
        status: statusOverrides[reminder.id] ?? reminder.status,
      })),
    [sourceReminders, statusOverrides],
  )
  const summary = summarizeRemindersByStatus(reminders)
  const reminderDateOptions = useMemo(
    () => getReminderDateOptions(reminders),
    [reminders],
  )
  const activeAppointmentDate = getActiveAppointmentDate(
    reminderDateOptions,
    selectedAppointmentDate,
  )
  const dateFilteredReminders = filterRemindersByAppointmentDate(
    reminders,
    activeAppointmentDate,
  )
  const activeDateSummary = summarizeRemindersByStatus(dateFilteredReminders)
  const filteredReminders = filterRemindersByStatus(
    dateFilteredReminders,
    statusFilter,
  )
  const reminderDateGroups =
    groupRemindersByAppointmentDate(filteredReminders)
  const selectedReminder =
    filteredReminders.find((reminder) => reminder.id === selectedReminderId) ??
    filteredReminders[0] ??
    (statusFilter === 'all' ? dateFilteredReminders[0] : undefined)
  const emptyListMessage =
    reminders.length === 0
      ? 'No hay recordatorios pendientes para citas activas.'
      : 'No hay recordatorios para esta fecha y filtro.'
  const emptyListDescription =
    reminders.length === 0
      ? 'Las citas canceladas no generan recordatorios.'
      : 'Prueba con otra fecha o estado de recordatorio.'

  useEffect(() => {
    if (!isToastVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsToastVisible(false), 3200)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  useEffect(() => {
    if (isToastVisible || !toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 220)

    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  async function updateReminderStatus(reminderId: string, status: ReminderStatus) {
    const targetReminder = reminders.find((reminder) => reminder.id === reminderId)

    if (status === 'sent' && !canMarkReminderAsSent(targetReminder)) {
      setSelectedReminderId(reminderId)
      setToastTone('error')
      setToastMessage('No se puede marcar como enviado sin teléfono registrado.')
      setIsToastVisible(true)
      return
    }

    setActionError('')

    if (persistedReminders) {
      const result =
        status === 'sent'
          ? await onMarkReminderSent?.(reminderId)
          : await onMarkReminderFailed?.(reminderId)

      if (result && !result.success) {
        setSelectedReminderId(reminderId)
        setActionError(result.error ?? 'No pudimos actualizar el recordatorio.')
        setToastTone('error')
        setToastMessage(result.error ?? 'No pudimos actualizar el recordatorio.')
        setIsToastVisible(true)
        return
      }
    } else {
      setStatusOverrides((currentOverrides) => ({
        ...currentOverrides,
        [reminderId]: status,
      }))
    }

    setSelectedReminderId(reminderId)
    setToastTone(status === 'sent' ? 'success' : 'error')
    setToastMessage(
      status === 'sent'
        ? 'Recordatorio marcado como enviado.'
        : 'Recordatorio marcado como fallido.',
    )
    setIsToastVisible(true)
  }

  return (
    <section className="reminders-view" aria-label="Recordatorios WhatsApp">
      <section className="reminder-kpi-panel" aria-label="Resumen de recordatorios">
        <div className="section-heading">
          <p className="eyebrow">Recordatorios</p>
          <h2>Recordatorios de citas</h2>
          <p className="section-description">
            Prepara y controla los mensajes de confirmacion para tus pacientes.
          </p>
          <p className="reminder-simulation-note">
            {persistedReminders
              ? 'Recordatorios persistidos. El envio sigue siendo manual; WhatsApp API vendra despues.'
              : 'Simulacion local: todavia no se envian mensajes reales por WhatsApp.'}
          </p>
          {(errorMessage || actionError) && (
            <p className="field-message field-message--error">
              {actionError || errorMessage}
            </p>
          )}
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
          <ReminderKpiCard
            label="Omitidos"
            tone="slate"
            value={summary.skipped}
          />
        </div>
      </section>

      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
      />

      <section className="reminders-layout">
        <article className="reminders-panel">
          <div className="section-heading">
            <p className="eyebrow">Cola local</p>
            <h2>Citas con recordatorios</h2>
          </div>

          {isLoading && (
            <div className="dashboard-empty-state reminder-empty-state">
              <strong>Cargando recordatorios...</strong>
              <span>Estamos preparando la cola del consultorio.</span>
            </div>
          )}

          {!isLoading && reminderDateOptions.length > 0 && (
            <div
              className="reminder-date-nav"
              aria-label="Seleccionar fecha de cita"
            >
              {reminderDateOptions.map((dateOption) => (
                <button
                  aria-label={dateOption.fullLabel}
                  aria-pressed={
                    activeAppointmentDate === dateOption.appointmentDate
                  }
                  className="reminder-date-tab"
                  key={dateOption.appointmentDate}
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentDate(dateOption.appointmentDate)
                    setSelectedReminderId(null)
                    setIsToastVisible(false)
                  }}
                >
                  <span>{dateOption.weekdayLabel}</span>
                  <strong>{dateOption.dateLabel}</strong>
                </button>
              ))}
            </div>
          )}

          <div
            className="reminder-filter-bar"
            aria-label="Filtrar recordatorios por estado"
          >
            {getReminderFilters().map((filter) => (
              <button
                aria-pressed={statusFilter === filter}
                className="reminder-filter"
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter)
                  setSelectedReminderId(null)
                  setIsToastVisible(false)
                }}
              >
                {filter === 'all'
                  ? `Todos (${dateFilteredReminders.length})`
                  : `${getReminderStatusLabel(filter)} (${activeDateSummary[filter]})`}
              </button>
            ))}
          </div>

          {!isLoading && (
            <RemindersList
              dateGroups={reminderDateGroups}
              emptyDescription={emptyListDescription}
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
                setIsToastVisible(false)
              }}
            />
          )}
        </article>

        <ReminderMessagePreview reminder={selectedReminder} />
      </section>
    </section>
  )
}

function getReminderFilters(): ReminderStatusFilter[] {
  return ['all', 'pending', 'scheduled', 'sent', 'failed', 'cancelled', 'skipped']
}

function getActiveAppointmentDate(
  reminderDateOptions: ReturnType<typeof getReminderDateOptions>,
  selectedAppointmentDate: string | null,
) {
  const selectedDateExists = reminderDateOptions.some(
    (dateOption) => dateOption.appointmentDate === selectedAppointmentDate,
  )

  if (selectedDateExists) {
    return selectedAppointmentDate
  }

  return reminderDateOptions[0]?.appointmentDate ?? null
}
