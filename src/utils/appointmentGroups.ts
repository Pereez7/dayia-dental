import type { Appointment, AppointmentStatus } from '../types/Appointment'
import { formatAppointmentDate } from './appointmentFormatters'
import { sortAppointmentsByDateTime } from './appointmentSorters'

export interface AgendaDayOption {
  date: string
  primaryLabel: string
  secondaryLabel: string
}

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

export function getDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getAppointmentsForDate(
  appointments: Appointment[],
  selectedDate: string,
) {
  return sortAppointmentsByDateTime(
    appointments.filter((appointment) => appointment.date === selectedDate),
  )
}

export function getVisibleAgendaDays(
  appointments: Appointment[],
  referenceDate = new Date(),
): AgendaDayOption[] {
  const today = getDateInputValue(referenceDate)
  const tomorrowDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 1,
  )
  const tomorrow = getDateInputValue(tomorrowDate)
  const futureAppointmentDates = appointments
    .map((appointment) => appointment.date)
    .filter((date) => date >= today)

  return Array.from(new Set([today, tomorrow, ...futureAppointmentDates]))
    .sort()
    .map((date) => getAgendaDayOption(date, referenceDate))
}

export function getAgendaDayOption(
  date: string,
  referenceDate = new Date(),
): AgendaDayOption {
  const today = getDateInputValue(referenceDate)
  const tomorrowDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 1,
  )
  const tomorrow = getDateInputValue(tomorrowDate)

  if (date === today) {
    return {
      date,
      primaryLabel: 'Hoy',
      secondaryLabel: formatAppointmentDate(date),
    }
  }

  if (date === tomorrow) {
    return {
      date,
      primaryLabel: 'Mañana',
      secondaryLabel: formatAppointmentDate(date),
    }
  }

  return {
    date,
    primaryLabel: getWeekdayShortLabel(date),
    secondaryLabel: formatAppointmentDate(date),
  }
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

function getWeekdayShortLabel(date: string) {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
  })
    .format(new Date(`${date}T00:00:00`))
    .replace('.', '')
}
