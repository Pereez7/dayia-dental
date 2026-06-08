import { DashboardActivityList } from '../components/DashboardActivityList'
import { DashboardAppointmentList } from '../components/DashboardAppointmentList'
import { DashboardKpiCard } from '../components/DashboardKpiCard'
import { DashboardPatientsList } from '../components/DashboardPatientsList'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getDashboardActivityMessages,
  getDashboardSummary,
  getRecentPatients,
  getUpcomingAppointments,
} from '../utils/dashboardMetrics'

interface DashboardViewProps {
  appointments: Appointment[]
  patients: Patient[]
}

export function DashboardView({ appointments, patients }: DashboardViewProps) {
  const summary = getDashboardSummary(appointments, patients)
  const upcomingAppointments = getUpcomingAppointments(appointments, 5)
  const recentPatients = getRecentPatients(patients, 4)
  const activityMessages = getDashboardActivityMessages(appointments)

  return (
    <section className="dashboard-view" aria-label="Dashboard principal">
      <section className="dashboard-kpi-grid" aria-label="Indicadores principales">
        <DashboardKpiCard
          label="Atenciones de hoy"
          tone="blue"
          value={summary.todayAppointments}
        />
        <DashboardKpiCard
          label="Atenciones del mes"
          tone="slate"
          value={summary.monthlyAppointments}
        />
        <DashboardKpiCard
          label="Pendientes por confirmar"
          tone="amber"
          value={summary.pendingAppointments}
        />
        <DashboardKpiCard
          label="Pacientes registrados"
          tone="green"
          value={summary.registeredPatients}
        />
        <DashboardKpiCard
          label="Reprogramadas del mes"
          tone="indigo"
          value={summary.monthlyRescheduledAppointments}
        />
      </section>

      <section className="dashboard-content-grid">
        <article className="dashboard-panel dashboard-panel--appointments">
          <div className="section-heading">
            <p className="eyebrow">Agenda</p>
            <h2>Proximas atenciones</h2>
            <p className="section-description">
              Las siguientes citas programadas, sin entrar a la agenda completa.
            </p>
          </div>

          <DashboardAppointmentList appointments={upcomingAppointments} />
        </article>

        <div className="dashboard-side-stack">
          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Pacientes</p>
              <h2>Pacientes recientes</h2>
            </div>

            <DashboardPatientsList patients={recentPatients} />
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Operacion</p>
              <h2>Resumen operativo</h2>
            </div>

            <DashboardActivityList messages={activityMessages} />
          </article>
        </div>
      </section>
    </section>
  )
}
