import type { Appointment } from '../data/appointments'
import { AppointmentCard } from './AppointmentCard'
import { StatsCard } from './StatsCard'

interface AppointmentsOverviewProps {
  appointments: Appointment[]
}

export function AppointmentsOverview({ appointments }: AppointmentsOverviewProps) {
  return (
    <section className="dashboard-grid" aria-label="Resumen de citas">
      <article className="overview-panel">
        <div className="section-heading">
          <p className="eyebrow">Hoy</p>
          <h2>Citas programadas</h2>
        </div>

        <div className="metric-row">
          <StatsCard value={8} label="Citas del dia" />
          <StatsCard value={5} label="Confirmadas" />
          <StatsCard value={3} label="Por recordar" />
        </div>
      </article>

      <article className="appointments-panel">
        <div className="section-heading">
          <p className="eyebrow">Agenda</p>
          <h2>Proximas atenciones</h2>
        </div>

        <div className="appointment-list">
          {appointments.map((appointment) => (
            <AppointmentCard appointment={appointment} key={appointment.id} />
          ))}
        </div>
      </article>
    </section>
  )
}
