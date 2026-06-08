import type { Appointment } from '../types/Appointment'
import {
  getAgendaDateLabel,
  groupAppointmentsByDate,
  summarizeAppointmentsByStatus,
} from '../utils/appointmentGroups'
import { AppointmentAgendaCard } from './AppointmentAgendaCard'

interface AppointmentsAgendaProps {
  appointments: Appointment[]
}

export function AppointmentsAgenda({ appointments }: AppointmentsAgendaProps) {
  const appointmentGroups = groupAppointmentsByDate(appointments)
  const statusSummary = summarizeAppointmentsByStatus(appointments)

  return (
    <section className="agenda-section" aria-label="Agenda de citas">
      <div className="section-heading">
        <p className="eyebrow">Agenda</p>
        <h2>Proximas citas</h2>
      </div>

      <div className="agenda-summary">
        <div className="agenda-kpi agenda-kpi--total">
          <strong>{appointments.length}</strong>
          <span>Proximas citas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--confirmed">
          <strong>{statusSummary.confirmed}</strong>
          <span>Confirmadas</span>
        </div>
        <div className="agenda-kpi agenda-kpi--pending">
          <strong>{statusSummary.pending}</strong>
          <span>Pendientes</span>
        </div>
        <div className="agenda-kpi agenda-kpi--rescheduled">
          <strong>{statusSummary.rescheduled}</strong>
          <span>Reprogramadas</span>
        </div>
      </div>

      <div className="agenda-groups">
        {appointmentGroups.map((group) => (
          <section className="agenda-day" key={group.date}>
            <h3>{getAgendaDateLabel(group.date)}</h3>

            <div className="agenda-list">
              {group.appointments.map((appointment) => (
                <AppointmentAgendaCard
                  appointment={appointment}
                  key={appointment.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
