import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import { summarizeAppointmentsByStatus } from './appointmentGroups'
import { sortAppointmentsByDateTime } from './appointmentSorters'

export interface DashboardSummary {
  monthlyAppointments: number
  monthlyRescheduledAppointments: number
  pendingAppointments: number
  registeredPatients: number
  todayAppointments: number
}

export function getDashboardSummary(
  appointments: Appointment[],
  patients: Patient[],
  referenceDate = new Date(),
): DashboardSummary {
  const allStatusSummary = summarizeAppointmentsByStatus(appointments)
  const monthlyAppointments = getMonthlyAppointments(appointments, referenceDate)

  return {
    monthlyAppointments: monthlyAppointments.length,
    monthlyRescheduledAppointments: monthlyAppointments.filter(
      (appointment) => appointment.status === 'rescheduled',
    ).length,
    pendingAppointments: allStatusSummary.pending,
    registeredPatients: patients.length,
    todayAppointments: getTodayAppointments(appointments, referenceDate).length,
  }
}

export function getTodayAppointments(
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return sortAppointmentsByDateTime(
    appointments.filter((appointment) => appointment.date === today),
  )
}

export function getUpcomingAppointments(
  appointments: Appointment[],
  limit = 5,
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return sortAppointmentsByDateTime(
    appointments.filter((appointment) => appointment.date >= today),
  ).slice(0, limit)
}

export function getMonthlyAppointments(
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const monthPrefix = formatMonthInputValue(referenceDate)

  return sortAppointmentsByDateTime(
    appointments.filter((appointment) => appointment.date.startsWith(monthPrefix)),
  )
}

export function getRecentPatients(patients: Patient[], limit = 4) {
  return patients.slice(0, limit)
}

export function getDashboardActivityMessages(
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const todayAppointments = getTodayAppointments(appointments, referenceDate)
  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === 'pending',
  )
  const monthlyAppointments = getMonthlyAppointments(appointments, referenceDate)
  const monthlyRescheduledAppointments = monthlyAppointments.filter(
    (appointment) => appointment.status === 'rescheduled',
  )

  const messages: string[] = []

  if (todayAppointments.length > 0) {
    messages.push(
      `Hoy tienes ${todayAppointments.length} atenciones programadas.`,
    )
  } else {
    messages.push('No hay citas para hoy.')
  }

  if (pendingAppointments.length > 0) {
    messages.push(
      `Tienes ${pendingAppointments.length} citas pendientes por confirmar.`,
    )
  } else {
    messages.push('No hay citas pendientes por confirmar.')
  }

  messages.push(
    `Este mes tienes ${monthlyAppointments.length} atenciones registradas.`,
  )

  if (monthlyRescheduledAppointments.length > 0) {
    messages.push(
      `Hay ${monthlyRescheduledAppointments.length} citas reprogramadas este mes.`,
    )
  }

  return messages
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatMonthInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}
