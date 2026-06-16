import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentId,
  AppointmentStatus,
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
  businessHours: BusinessHoursSettings
  calendarExceptions: CalendarException[]
  errorMessage?: string
  isLoading?: boolean
  patients: Patient[]
  treatments: Treatment[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (
    values: AppointmentFormValues,
  ) => Promise<{ error?: string; success: boolean }> | { error?: string; success: boolean } | void
  onNavigateToAgenda?: () => void
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
  businessHours,
  calendarExceptions,
  errorMessage = '',
  isLoading = false,
  patients,
  treatments,
  mode = 'agenda',
  onCreateAppointment,
  onNavigateToAgenda,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
}: AppointmentsViewProps) {
  function handleCreateAppointment(values: AppointmentFormValues) {
    return onCreateAppointment?.(values)
  }

  if (mode === 'new') {
    return (
      <AppointmentForm
        appointments={appointments}
        businessHours={businessHours}
        calendarExceptions={calendarExceptions}
        patients={patients}
        treatments={treatments}
        onCancel={() => onNavigateToAgenda?.()}
        onCreateAppointment={handleCreateAppointment}
      />
    )
  }

  return (
    <AppointmentsAgenda
      appointments={appointments}
      businessHours={businessHours}
      calendarExceptions={calendarExceptions}
      errorMessage={errorMessage}
      isLoading={isLoading}
      onRescheduleAppointment={onRescheduleAppointment}
      patients={patients}
      treatments={treatments}
      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
    />
  )
}
