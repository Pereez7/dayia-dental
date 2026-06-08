import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
import { patients } from '../data/patients'
import type { Appointment, AppointmentFormValues } from '../types/Appointment'

interface AppointmentsViewProps {
  appointments: Appointment[]
  mode?: 'agenda' | 'new'
  onCreateAppointment?: (values: AppointmentFormValues) => void
  onNavigateToAgenda?: () => void
}

export function AppointmentsView({
  appointments,
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
