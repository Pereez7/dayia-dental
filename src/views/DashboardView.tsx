import { AppointmentsOverview } from '../components/AppointmentsOverview'
import type { Appointment } from '../types/Appointment'

interface DashboardViewProps {
  appointments: Appointment[]
}

export function DashboardView({ appointments }: DashboardViewProps) {
  return (
    <section className="view-stack">
      <AppointmentsOverview appointments={appointments} />
    </section>
  )
}
