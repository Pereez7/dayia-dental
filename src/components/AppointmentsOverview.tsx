import type { Appointment } from '../types/Appointment'
import { summarizeAppointmentsByStatus } from '../utils/appointmentGroups'
import { sortAppointmentsByDateTime } from '../utils/appointmentSorters'
import { AppointmentCard } from './AppointmentCard'
import { StatsCard } from './StatsCard'

interface AppointmentsOverviewProps {
  appointments: Appointment[]
}

export function AppointmentsOverview({ appointments }: AppointmentsOverviewProps) {
  const statusSummary = summarizeAppointmentsByStatus(appointments)
  const upcomingAppointments = sortAppointmentsByDateTime(appointments).slice(0, 5)

  return (
    <section className="dashboard-grid" aria-label="Resumen de citas">
      <article className="overview-panel">
        <div className="section-heading">
          <p className="eyebrow">Dashboard</p>
          <h2>Resumen de citas</h2>
        </div>

        <div className="metric-row">
          <StatsCard value={appointments.length} label="Próximas citas" />
          <StatsCard value={statusSummary.confirmed} label="Confirmadas" />
          <StatsCard value={statusSummary.pending} label="Pendientes" />
        </div>
      </article>

      <article className="appointments-panel">
        <div className="section-heading">
          <p className="eyebrow">Agenda</p>
          <h2>Próximas atenciones</h2>
        </div>

        <div className="appointment-list">
          {upcomingAppointments.map((appointment) => (
            <AppointmentCard appointment={appointment} key={appointment.id} />
          ))}
        </div>
      </article>
    </section>
  )
}
