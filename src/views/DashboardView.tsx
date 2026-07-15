import { DashboardActivityList } from '../components/DashboardActivityList'
import { DashboardAppointmentList } from '../components/DashboardAppointmentList'
import { DashboardAttentionList } from '../components/DashboardAttentionList'
import { DashboardKpiCard } from '../components/DashboardKpiCard'
import { DashboardPanelSkeleton } from '../components/DashboardPanelSkeleton'
import { DashboardPatientsList } from '../components/DashboardPatientsList'
import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getAppointmentsRequiringAttention,
  getDashboardSummary,
  getRecentAppointmentActivity,
  getRecentPatients,
  getUpcomingAppointments,
} from '../utils/dashboardMetrics'

interface DashboardViewProps {
  appointments: Appointment[]
  isLoading?: boolean
  patients: Patient[]
  referenceDate?: Date
}

export function DashboardView({
  appointments,
  isLoading = false,
  patients,
  referenceDate = new Date(),
}: DashboardViewProps) {
  const summary = getDashboardSummary(appointments, patients, referenceDate)
  const upcomingAppointments = getUpcomingAppointments(
    appointments,
    5,
    referenceDate,
  )
  const recentPatients = getRecentPatients(patients, 4)
  const attentionItems = getAppointmentsRequiringAttention(
    appointments,
    5,
    referenceDate,
  )
  const recentActivity = getRecentAppointmentActivity(appointments, 5)
  const dateLabel = new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(referenceDate)

  return (
    <section className="dashboard-view" aria-label="Dashboard principal">
      <section className="dashboard-kpi-panel" aria-label="Indicadores principales">
        <div className="section-heading dashboard-kpi-heading">
          <h2>Operación de hoy</h2>
          <p className="section-description">{dateLabel}</p>
        </div>

        <div className="dashboard-kpi-grid dashboard-kpi-grid--today">
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
        </div>

        <div className="dashboard-kpi-divider" />

        <div className="section-heading dashboard-kpi-heading">
          <h3>Resumen del mes</h3>
          <p className="section-description">
            Movimientos registrados y pacientes activos del consultorio.
          </p>
        </div>

        <div className="dashboard-kpi-grid dashboard-kpi-grid--month">
          <DashboardKpiCard
            isLoading={isLoading}
            label="Reprogramaciones del mes"
            tone="indigo"
            value={summary.monthlyRescheduledAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Cancelaciones del mes"
            tone="red"
            value={summary.monthlyCancelledAppointments}
          />
          <DashboardKpiCard
            isLoading={isLoading}
            label="Pacientes activos"
            tone="slate"
            value={summary.registeredPatients}
          />
        </div>
      </section>

      <section className="dashboard-content-grid">
        <article className="dashboard-panel dashboard-panel--appointments">
          <div className="section-heading">
            <h2>Próximas citas</h2>
            <p className="section-description">
              Las siguientes citas activas ordenadas por fecha y hora.
            </p>
          </div>

          {isLoading ? (
            <DashboardPanelSkeleton label="Cargando próximas citas" rows={5} />
          ) : (
            <DashboardAppointmentList appointments={upcomingAppointments} />
          )}
        </article>

        <div className="dashboard-side-stack">
          <article className="dashboard-panel">
            <div className="section-heading">
              <h2>Requieren atención</h2>
              <p className="section-description">
                Pendientes y reprogramaciones recientes.
              </p>
            </div>

            {isLoading ? (
              <DashboardPanelSkeleton label="Cargando seguimiento" />
            ) : (
              <DashboardAttentionList items={attentionItems} />
            )}
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <h2>Actividad reciente</h2>
            </div>

            {isLoading ? (
              <DashboardPanelSkeleton label="Cargando actividad reciente" />
            ) : (
              <DashboardActivityList activities={recentActivity} />
            )}
          </article>

          <article className="dashboard-panel">
            <div className="section-heading">
              <h2>Pacientes recientes</h2>
            </div>

            {isLoading ? (
              <DashboardPanelSkeleton label="Cargando pacientes recientes" />
            ) : (
              <DashboardPatientsList patients={recentPatients} />
            )}
          </article>
        </div>
      </section>
    </section>
  )
}
