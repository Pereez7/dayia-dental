import { DashboardActivityList } from '../components/DashboardActivityList'
import { DashboardAppointmentList } from '../components/DashboardAppointmentList'
import { DashboardAttentionList } from '../components/DashboardAttentionList'
import { DashboardKpiCard } from '../components/DashboardKpiCard'
import { DashboardMonthSummary } from '../components/DashboardMonthSummary'
import { DashboardPatientsList } from '../components/DashboardPatientsList'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getAppointmentsRequiringAttention,
  getDashboardSummary,
  getMonthlyStatusSummary,
  getRecentAppointmentActivity,
  getRecentPatients,
  getUpcomingAppointments,
} from '../utils/dashboardMetrics'

interface DashboardViewProps {
  appointments: Appointment[]
  isLoading?: boolean
  patients: Patient[]
}

export function DashboardView({
  appointments,
  isLoading = false,
  patients,
}: DashboardViewProps) {
  const summary = getDashboardSummary(appointments, patients)
  const upcomingAppointments = getUpcomingAppointments(appointments, 5)
  const recentPatients = getRecentPatients(patients, 4)
  const attentionItems = getAppointmentsRequiringAttention(
    appointments,
    patients,
    5,
  )
  const recentActivity = getRecentAppointmentActivity(appointments, 5)
  const monthlySummary = getMonthlyStatusSummary(appointments)

  return (
    <section className="dashboard-view" aria-label="Dashboard principal">
      <section className="dashboard-kpi-panel" aria-label="Indicadores principales">
        <div className="section-heading dashboard-kpi-heading">
          <p className="eyebrow">Operacion diaria</p>
          <h2>Indicadores del consultorio</h2>
        </div>

        <div className="dashboard-kpi-grid">
          <DashboardKpiCard
            isLoading={isLoading}
            label="Citas de hoy"
            tone="blue"
            value={summary.todayAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Pendientes de hoy"
            tone="amber"
            value={summary.todayPendingAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Confirmadas de hoy"
            tone="green"
            value={summary.todayConfirmedAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Reprogramadas del mes"
            tone="indigo"
            value={summary.monthlyRescheduledAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Canceladas del mes"
            tone="red"
            value={summary.monthlyCancelledAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Pacientes registrados"
            tone="slate"
            value={summary.registeredPatients}
          />
        </div>
      </section>

      <section className="dashboard-content-grid">
        <article className="dashboard-panel dashboard-panel--appointments">
          <div className="section-heading">
            <p className="eyebrow">Agenda</p>
            <h2>Proximas citas</h2>
            <p className="section-description">
              Las siguientes citas activas ordenadas por fecha y hora.
            </p>
          </div>

          <DashboardAppointmentList appointments={upcomingAppointments} />
        </article>

        <div className="dashboard-side-stack">
          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Seguimiento</p>
              <h2>Requieren atencion</h2>
            </div>

            <DashboardAttentionList items={attentionItems} />
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Actividad</p>
              <h2>Actividad reciente</h2>
            </div>

            <DashboardActivityList activities={recentActivity} />
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Mes actual</p>
              <h2>Resumen del mes</h2>
            </div>

            <DashboardMonthSummary summary={monthlySummary} />
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <p className="eyebrow">Pacientes</p>
              <h2>Pacientes recientes</h2>
            </div>

            <DashboardPatientsList patients={recentPatients} />
          </article>
        </div>
      </section>
    </section>
  )
}
