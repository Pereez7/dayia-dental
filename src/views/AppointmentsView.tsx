import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import type { Appointment, AppointmentFormValues } from '../types/Appointment'
import type { Patient } from '../types/Patient'

interface AppointmentsViewProps {
  appointments: Appointment[]
  patients: Patient[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (values: AppointmentFormValues) => void
  onNavigateToAgenda?: () => void
}

export function AppointmentsView({
  appointments,
  patients,
  mode = 'agenda',
  onCreateAppointment,
  onNavigateToAgenda,
}: AppointmentsViewProps) {
  function handleCreateAppointment(values: AppointmentFormValues) {
    onCreateAppointment?.(values)
  }

  if (mode === 'new') {
    return (
      <AppointmentForm
        patients={patients}
        onCancel={() => onNavigateToAgenda?.()}
        onCreateAppointment={handleCreateAppointment}
      />
    )
  }

  return <AppointmentsAgenda appointments={appointments} />
}
