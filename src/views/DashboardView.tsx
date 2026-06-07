import { AppointmentsOverview } from '../components/AppointmentsOverview'
import { appointments } from '../data/appointments'

export function DashboardView() {
  return (
    <section className="view-stack">
      <AppointmentsOverview appointments={appointments} />
    </section>
  )
}
