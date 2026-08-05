import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentId,
  AppointmentStatus,
  AppointmentStatusSummary,
} from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import type { Treatment } from '../types/Treatment'
import type { AppointmentReasonPayload } from '../utils/appointmentReasons'

interface AppointmentsViewProps {
  appointments: Appointment[]
  availabilityAppointments?: Appointment[]
  agendaDayOptions?: string[]
  agendaHasMore?: boolean
  agendaIsLoadingMore?: boolean
  agendaSelectedDate?: string
  agendaStatusSummary?: AppointmentStatusSummary
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  draft?: AppointmentFormValues | null
  errorMessage?: string
  isLoading?: boolean
  isSettingsLoading?: boolean
  initialPatient?: Patient
  patients: Patient[]
  treatments: Treatment[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (
    values: AppointmentFormValues,
  ) => Promise<{ error?: string; success: boolean }> | { error?: string; success: boolean } | void
  onNavigateToAgenda?: () => void
  onAgendaDateChange?: (date: string) => void
  onAgendaLoadAvailability?: (
    date: string,
  ) => Promise<{ data: Appointment[] | null; error: string | null }>
  onAgendaLoadMore?: () => void
  onDraftChange?: (values: AppointmentFormValues) => void
  onNavigateToNewAppointment?: () => void
  onRescheduleAppointment?: (
    appointmentId: AppointmentId,
    date: string,
    time: string,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<{ error?: string; success: boolean }> | { error?: string; success: boolean } | void
  onUpdateAppointmentStatus?: (
    appointmentId: AppointmentId,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) => Promise<{ error?: string; success: boolean }> | { error?: string; success: boolean } | void
}

export function AppointmentsView({
  appointments,
  availabilityAppointments,
  agendaDayOptions,
  agendaHasMore,
  agendaIsLoadingMore,
  agendaSelectedDate,
  agendaStatusSummary,
  businessHours,
  calendarExceptions,
  draft,
  errorMessage = '',
  isLoading = false,
  isSettingsLoading = false,
  initialPatient,
  patients,
  treatments,
  mode = 'agenda',
  onCreateAppointment,
  onAgendaDateChange,
  onAgendaLoadAvailability,
  onAgendaLoadMore,
  onNavigateToAgenda,
  onDraftChange,
  onNavigateToNewAppointment,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
}: AppointmentsViewProps) {
  function handleCreateAppointment(values: AppointmentFormValues) {
    return onCreateAppointment?.(values)
  }

  if (mode === 'new') {
    if (isSettingsLoading) {
      return (
        <section className="module-loading-state" aria-live="polite">
          <strong>Preparando la agenda...</strong>
          <span>Cargando horarios y tratamientos del consultorio.</span>
        </section>
      )
    }

    return (
      <AppointmentForm
        appointments={appointments}
        businessHours={businessHours}
        calendarExceptions={calendarExceptions}
        draft={draft}
        initialPatient={initialPatient}
        patients={patients}
        treatments={treatments}
        onCancel={() => onNavigateToAgenda?.()}
        onDraftChange={onDraftChange}
        onCreateAppointment={handleCreateAppointment}
      />
    )
  }

  return (
    <AppointmentsAgenda
      appointments={appointments}
      availabilityAppointments={availabilityAppointments}
      businessHours={businessHours}
      calendarExceptions={calendarExceptions}
      errorMessage={errorMessage}
      dayOptions={agendaDayOptions}
      hasMore={agendaHasMore}
      isLoading={isLoading}
      isLoadingMore={agendaIsLoadingMore}
      selectedDate={agendaSelectedDate}
      statusSummary={agendaStatusSummary}
      onDateChange={onAgendaDateChange}
      onLoadAvailability={onAgendaLoadAvailability}
      onLoadMore={onAgendaLoadMore}
      onCreateAppointment={onNavigateToNewAppointment}
      onRescheduleAppointment={onRescheduleAppointment}
      patients={patients}
      treatments={treatments}
      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
    />
  )
}
