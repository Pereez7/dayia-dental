import { useEffect, useMemo, useState } from 'react'
import { ReminderKpiCard } from '../components/ReminderKpiCard'
import { ReminderMessagePreview } from '../components/ReminderMessagePreview'
import { RemindersList } from '../components/RemindersList'
import {
  ResolvePastAppointmentDialog,
  type AppointmentResolutionResult,
} from '../components/ResolvePastAppointmentDialog'
import { Toast } from '../components/Toast'
import type { Appointment } from '../types/Appointment'
import type { AppointmentId, AppointmentStatus } from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import type {
  Reminder,
  ReminderStatus,
  ReminderStatusFilter,
} from '../types/Reminder'
import type { Treatment } from '../types/Treatment'
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
import {
  filterRemindersByAppointmentStatus,
  filterRemindersBySearch,
  getReminderEmptyStateCopy,
  type ReminderAppointmentStatusFilter,
} from '../utils/reminderView'
import type { AppointmentReasonPayload } from '../utils/appointmentReasons'

interface WhatsAppRemindersViewProps {
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  errorMessage?: string
  isLoading?: boolean
  patients: Patient[]
  planId?: string | null
  reminders?: Reminder[]
  treatments: Treatment[]
  onMarkReminderFailed?: (
    reminderId: string,
  ) => Promise<ReminderActionResult> | ReminderActionResult
  onMarkReminderSent?: (
    reminderId: string,
  ) => Promise<ReminderActionResult> | ReminderActionResult
  onRescheduleAppointment?: (
    appointmentId: AppointmentId,
    date: string,
    time: string,
    reasonPayload: AppointmentReasonPayload,
  ) => Promise<AppointmentResolutionResult> | AppointmentResolutionResult
  onUpdateAppointmentStatus?: (
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<AppointmentResolutionResult> | AppointmentResolutionResult
}

interface ReminderActionResult {
  error?: string
  success: boolean
}

export function WhatsAppRemindersView({
  appointments,
  businessHours,
  calendarExceptions,
  errorMessage = '',
  isLoading = false,
  patients,
  planId = null,
  reminders: persistedReminders,
  treatments,
  onMarkReminderFailed,
  onMarkReminderSent,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
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
  const [appointmentStatusFilter, setAppointmentStatusFilter] =
    useState<ReminderAppointmentStatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<'error' | 'success'>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [actionError, setActionError] = useState('')
  const [resolvingAppointmentId, setResolvingAppointmentId] = useState<
    AppointmentId | null
  >(null)
  const [pendingAction, setPendingAction] = useState<{
    reminderId: string
    status: 'failed' | 'sent'
  } | null>(null)
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
  const statusFilteredReminders = filterRemindersByStatus(
    dateFilteredReminders,
    statusFilter,
  )
  const appointmentFilteredReminders = filterRemindersByAppointmentStatus(
    statusFilteredReminders,
    appointmentStatusFilter,
  )
  const filteredReminders = filterRemindersBySearch(
    appointmentFilteredReminders,
    searchTerm,
  )
  const reminderDateGroups =
    groupRemindersByAppointmentDate(filteredReminders)
  const selectedReminder =
    filteredReminders.find((reminder) => reminder.id === selectedReminderId)
  const emptyListCopy = getReminderEmptyStateCopy(
    reminders.length > 0,
    statusFilter,
  )
  const isProPlan = planId === 'pro'
  const resolvingAppointment =
    appointments.find(
      (appointment) => appointment.id === resolvingAppointmentId,
    ) ?? null
  const selectedReminderMatchesCurrentAppointment = selectedReminder
    ? appointments.some(
        (appointment) =>
          appointment.id === selectedReminder.appointmentId &&
          appointment.date === selectedReminder.appointmentDate &&
          appointment.time === selectedReminder.appointmentTime,
      )
    : false

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
    if (pendingAction) {
      return
    }

    const targetReminder = reminders.find((reminder) => reminder.id === reminderId)

    if (status === 'sent' && !canMarkReminderAsSent(targetReminder)) {
      setSelectedReminderId(reminderId)
      setToastTone('error')
      setToastMessage('No se puede marcar como enviado sin teléfono registrado.')
      setIsToastVisible(true)
      return
    }

    setActionError('')
    setPendingAction({
      reminderId,
      status: status === 'sent' ? 'sent' : 'failed',
    })

    try {
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
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section className="reminders-view" aria-label="Recordatorios WhatsApp">
      <section className="reminder-kpi-panel" aria-label="Resumen de recordatorios">
        <div className="reminder-summary-heading">
          <div className="section-heading">
            <h2>Estado de recordatorios</h2>
            <p className="section-description">
              Revisa la cola y registra el resultado de cada contacto.
            </p>
          </div>
          <span className="reminder-mode-badge">
            {isProPlan
              ? 'Automático pendiente de configuración'
              : 'Modo manual'}
          </span>
        </div>

        <div className="reminder-operation-note" role="note">
          <strong>Envío manual disponible</strong>
          <span>
            El envío automático por WhatsApp API todavía no está activo. Puedes
            abrir WhatsApp manualmente y marcar el recordatorio según corresponda.
          </span>
          {!persistedReminders && (
            <span>Esta sesión usa recordatorios de demostración.</span>
          )}
        </div>

        <div aria-live="polite">
          {(errorMessage || actionError) && (
            <p className="field-message field-message--error" role="alert">
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
            label="Enviados"
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
          <ReminderKpiCard
            label="Cancelados"
            tone="slate"
            value={summary.cancelled}
          />
        </div>
      </section>

      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
      />

      <ResolvePastAppointmentDialog
        appointment={resolvingAppointment}
        appointments={appointments}
        businessHours={businessHours}
        calendarExceptions={calendarExceptions}
        isOpen={Boolean(resolvingAppointment)}
        key={resolvingAppointment ? String(resolvingAppointment.id) : 'closed'}
        onCancel={() => setResolvingAppointmentId(null)}
        onResolved={(message) => {
          setResolvingAppointmentId(null)
          setToastTone('success')
          setToastMessage(message)
          setIsToastVisible(true)
        }}
        onReschedule={async (appointmentId, date, time, reasonPayload) =>
          onRescheduleAppointment?.(
            appointmentId,
            date,
            time,
            reasonPayload,
          ) ?? {
            error: 'La reprogramación no está disponible.',
            success: false,
          }
        }
        onUpdateStatus={async (appointmentId, status, reasonPayload) =>
          onUpdateAppointmentStatus?.(
            appointmentId,
            status,
            reasonPayload,
          ) ?? {
            error: 'La resolución de citas no está disponible.',
            success: false,
          }
        }
        treatments={treatments}
      />

      <section className="reminders-layout">
        <article className="reminders-panel">
          <div className="section-heading">
            <h2>Cola de recordatorios</h2>
            <p className="section-description">
              Elige una fecha y filtra por estado para revisar cada contacto.
            </p>
          </div>

          {isLoading && (
            <div className="reminder-loading-state" aria-live="polite">
              <span className="reminder-loading-line reminder-loading-line--short" />
              <span className="reminder-loading-line" />
              <span className="reminder-loading-line" />
              <span className="sr-only">Cargando recordatorios del consultorio.</span>
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

          {!isLoading && (
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
          )}

          {!isLoading && reminders.length > 0 && (
            <div className="reminder-secondary-filters">
              <label className="reminder-search-field">
                <span>Buscar en recordatorios</span>
                <input
                  placeholder="Paciente, teléfono o tratamiento"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setSelectedReminderId(null)
                  }}
                />
              </label>
              <label className="reminder-appointment-filter">
                <span>Estado de la cita</span>
                <select
                  value={appointmentStatusFilter}
                  onChange={(event) => {
                    setAppointmentStatusFilter(
                      event.target.value as ReminderAppointmentStatusFilter,
                    )
                    setSelectedReminderId(null)
                  }}
                >
                  <option value="all">Todas las citas</option>
                  <option value="pending">Pendiente</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="rescheduled">Reprogramada</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="completed">Atendida</option>
                  <option value="no_show">No asistió</option>
                  <option value="past_unresolved">Pasada sin cierre</option>
                </select>
              </label>
            </div>
          )}

          {!isLoading && (
            <RemindersList
              canResolveAppointment={(appointmentId, date, time) =>
                appointments.some(
                  (appointment) =>
                    appointment.id === appointmentId &&
                    appointment.date === date &&
                    appointment.time === time,
                )
              }
              dateGroups={reminderDateGroups}
              emptyDescription={emptyListCopy.description}
              emptyMessage={emptyListCopy.message}
              pendingAction={pendingAction}
              selectedReminderId={selectedReminder?.id ?? null}
              onMarkFailed={(reminderId) =>
                updateReminderStatus(reminderId, 'failed')
              }
              onMarkSent={(reminderId) =>
                updateReminderStatus(reminderId, 'sent')
              }
              onResolveAppointment={setResolvingAppointmentId}
              onSelectReminder={(reminderId) => {
                setSelectedReminderId(reminderId)
                setIsToastVisible(false)
              }}
            />
          )}
        </article>

        <ReminderMessagePreview
          canResolveAppointment={selectedReminderMatchesCurrentAppointment}
          onResolveAppointment={setResolvingAppointmentId}
          reminder={selectedReminder}
        />
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
