import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import type {
  Appointment,
  AppointmentFormValues,
  AppointmentStatus,
} from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import type { Patient } from '../types/Patient'
import type { Treatment } from '../types/Treatment'

interface AppointmentsViewProps {
  appointments: Appointment[]
  businessHours: BusinessHoursSettings
  patients: Patient[]
  treatments: Treatment[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (values: AppointmentFormValues) => void
  onNavigateToAgenda?: () => void
  onUpdateAppointmentStatus?: (
    appointmentId: number,
    status: AppointmentStatus,
  ) => void
}

export function AppointmentsView({
  appointments,
  businessHours,
  patients,
  treatments,
  mode = 'agenda',
  onCreateAppointment,
  onNavigateToAgenda,
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
      patients={patients}
      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
    />
  )
}
