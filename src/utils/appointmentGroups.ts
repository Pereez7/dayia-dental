import type { Appointment, AppointmentStatus } from '../types/Appointment'
import { formatAppointmentDate } from './appointmentFormatters'
import { sortAppointmentsByDateTime } from './appointmentSorters'

export interface AppointmentDateGroup {
  appointments: Appointment[]
  date: string
}

export function groupAppointmentsByDate(
  appointments: Appointment[],
): AppointmentDateGroup[] {
  const groups = new Map<string, Appointment[]>()

  for (const appointment of sortAppointmentsByDateTime(appointments)) {
    const groupAppointments = groups.get(appointment.date) ?? []
    groupAppointments.push(appointment)
    groups.set(appointment.date, groupAppointments)
  }

  return Array.from(groups, ([date, groupAppointments]) => ({
    appointments: groupAppointments,
    date,
  }))
}

export function getAgendaDateLabel(date: string, referenceDate = new Date()) {
  const targetDate = new Date(`${date}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (targetDate.getTime() === today.getTime()) {
    return `Hoy, ${formatAppointmentDate(date)}`
  }

  if (targetDate.getTime() === tomorrow.getTime()) {
    return `Mañana, ${formatAppointmentDate(date)}`
  }

  return formatAppointmentDate(date)
}

export function summarizeAppointmentsByStatus(appointments: Appointment[]) {
  const initialSummary: Record<AppointmentStatus, number> = {
    cancelled: 0,
    completed: 0,
    confirmed: 0,
    pending: 0,
    rescheduled: 0,
  }

  return appointments.reduce((summary, appointment) => {
    summary[appointment.status] += 1
    return summary
  }, initialSummary)
}
