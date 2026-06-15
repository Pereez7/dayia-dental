import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import type {
  Appointment,
  AppointmentFormValues,
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
  patients: Patient[]
  treatments: Treatment[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (values: AppointmentFormValues) => void
  onNavigateToAgenda?: () => void
  onRescheduleAppointment?: (
    appointmentId: number,
    date: string,
    time: string,
    reasonPayload?: AppointmentReasonPayload,
  ) => void
  onUpdateAppointmentStatus?: (
    appointmentId: number,
    status: AppointmentStatus,
    reasonPayload?: AppointmentReasonPayload,
  ) => void
}

export function AppointmentsView({
  appointments,
  businessHours,
  calendarExceptions,
  patients,
  treatments,
  mode = 'agenda',
  onCreateAppointment,
  onNavigateToAgenda,
  onRescheduleAppointment,
  onUpdateAppointmentStatus,
}: AppointmentsViewProps) {
  function handleCreateAppointment(values: AppointmentFormValues) {
    onCreateAppointment?.(values)
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
      onRescheduleAppointment={onRescheduleAppointment}
      patients={patients}
      treatments={treatments}
      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
    />
  )
}
