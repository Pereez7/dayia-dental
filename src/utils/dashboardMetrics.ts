import type { Appointment, AppointmentChangeLogEntry } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import { summarizeAppointmentsByStatus } from './appointmentGroups'
import { sortAppointmentsByDateTime } from './appointmentSorters'
import {
  formatAppointmentChangeLogTimestamp,
  getAppointmentLogDisplayText,
} from './appointmentChangeLog'

export interface DashboardSummary {
  monthlyCancelledAppointments: number
  monthlyRescheduledAppointments: number
  registeredPatients: number
  todayAppointments: number
  todayConfirmedAppointments: number
  todayPendingAppointments: number
}

export interface DashboardMonthlySummary {
  cancelled: number
  confirmed: number
  rescheduled: number
  total: number
}

export interface DashboardAttentionItem {
  detail: string
  id: string
  label: string
  tone: 'amber' | 'blue' | 'red' | 'violet'
}

export interface DashboardActivityItem {
  description: string
  id: string
  occurredAt: string
  patient: string
}

export function getDashboardSummary(
  appointments: Appointment[],
  patients: Patient[],
  referenceDate = new Date(),
): DashboardSummary {
  const todayAppointments = getTodayAppointments(appointments, referenceDate)
  const todayStatusSummary = summarizeAppointmentsByStatus(todayAppointments)
  const monthlyStatusSummary = getMonthlyStatusSummary(
    appointments,
    referenceDate,
  )

  return {
    monthlyCancelledAppointments: monthlyStatusSummary.cancelled,
    monthlyRescheduledAppointments: monthlyStatusSummary.rescheduled,
    registeredPatients: patients.filter(({ status }) => status !== 'inactive')
      .length,
    todayAppointments: todayAppointments.length,
    todayConfirmedAppointments: todayStatusSummary.confirmed,
    todayPendingAppointments: todayStatusSummary.pending,
  }
}

export function getTodayAppointments(
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return sortAppointmentsByDateTime(
    appointments.filter(
      (appointment) =>
        appointment.date === today && isActiveAppointment(appointment),
    ),
  )
}

export function getUpcomingAppointments(
  appointments: Appointment[],
  limit = 5,
  referenceDate = new Date(),
) {
  return sortAppointmentsByDateTime(
    appointments.filter(
      (appointment) =>
        isActiveAppointment(appointment) &&
        getAppointmentDateTime(appointment) >= referenceDate,
    ),
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

export function getMonthlyStatusSummary(
  appointments: Appointment[],
  referenceDate = new Date(),
): DashboardMonthlySummary {
  const monthlyAppointments = getMonthlyAppointments(appointments, referenceDate)
  const statusSummary = summarizeAppointmentsByStatus(monthlyAppointments)

  return {
    cancelled: getMonthlyChangeCount(
      appointments,
      monthlyAppointments,
      'cancelled',
      referenceDate,
    ),
    confirmed: statusSummary.confirmed,
    rescheduled: getMonthlyChangeCount(
      appointments,
      monthlyAppointments,
      'rescheduled',
      referenceDate,
    ),
    total: monthlyAppointments.length,
  }
}

export function getRecentPatients(patients: Patient[], limit = 4) {
  return patients.filter(({ status }) => status !== 'inactive').slice(0, limit)
}

export function getAppointmentsRequiringAttention(
  appointments: Appointment[],
  limit = 5,
  referenceDate = new Date(),
): DashboardAttentionItem[] {
  const today = formatDateInputValue(referenceDate)
  const upcomingAppointments = sortAppointmentsByDateTime(
    appointments.filter(
      (appointment) =>
        appointment.date >= today && isActiveAppointment(appointment),
    ),
  )
  const attentionItems: DashboardAttentionItem[] = []

  for (const appointment of upcomingAppointments) {
    if (appointment.status === 'pending') {
      attentionItems.push({
        detail: formatAttentionDetail(appointment),
        id: `pending-${appointment.id}`,
        label: 'Pendiente por confirmar',
        tone: 'amber',
      })
    }

  }

  for (const appointment of getRecentlyChangedAppointments(
    appointments,
    'rescheduled',
    referenceDate,
  )) {
    attentionItems.push({
      detail: formatAttentionDetail(appointment),
      id: `rescheduled-${appointment.id}`,
      label: 'Reprogramada recientemente',
      tone: 'violet',
    })
  }

  return attentionItems.slice(0, limit)
}

export function getRecentAppointmentActivity(
  appointments: Appointment[],
  limit = 5,
): DashboardActivityItem[] {
  return appointments
    .flatMap((appointment) =>
      (appointment.changeLog ?? []).map((entry) =>
        createActivityItem(appointment, entry),
      ),
    )
    .sort(
      (firstItem, secondItem) =>
        new Date(secondItem.occurredAt).getTime() -
        new Date(firstItem.occurredAt).getTime(),
    )
    .slice(0, limit)
}

export function getDashboardActivityMessages(
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const todayAppointments = getTodayAppointments(appointments, referenceDate)
  const todayStatusSummary = summarizeAppointmentsByStatus(todayAppointments)
  const monthlyStatusSummary = getMonthlyStatusSummary(
    appointments,
    referenceDate,
  )

  const messages: string[] = []

  if (todayAppointments.length > 0) {
    messages.push(
      `Hoy tienes ${todayAppointments.length} atenciones programadas.`,
    )
  } else {
    messages.push('No hay citas para hoy.')
  }

  if (todayStatusSummary.pending > 0) {
    messages.push(
      `Tienes ${todayStatusSummary.pending} citas pendientes de hoy por confirmar.`,
    )
  } else {
    messages.push('No hay citas pendientes para hoy.')
  }

  messages.push(
    `Este mes tienes ${monthlyStatusSummary.total} atenciones registradas.`,
  )

  if (monthlyStatusSummary.rescheduled > 0) {
    messages.push(
      `Hay ${monthlyStatusSummary.rescheduled} citas reprogramadas este mes.`,
    )
  }

  return messages
}

function createActivityItem(
  appointment: Appointment,
  entry: AppointmentChangeLogEntry,
): DashboardActivityItem {
  return {
    description: getActivityDescription(entry),
    id: `${appointment.id}-${entry.id}`,
    occurredAt: entry.createdAt,
    patient: appointment.patient,
  }
}

function getActivityDescription(entry: AppointmentChangeLogEntry) {
  if (entry.type === 'confirmed') {
    return 'Cita confirmada'
  }

  if (entry.type === 'cancelled') {
    return 'Cita cancelada'
  }

  if (entry.type === 'rescheduled') {
    return getAppointmentLogDisplayText(entry).replace(/\.$/, '')
  }

  if (entry.type === 'created') {
    return 'Cita creada'
  }

  return entry.description.replace(/\.$/, '')
}

function getRecentlyChangedAppointments(
  appointments: Appointment[],
  type: AppointmentChangeLogEntry['type'],
  referenceDate: Date,
) {
  const recentThreshold = new Date(referenceDate)
  recentThreshold.setDate(recentThreshold.getDate() - 14)
  const today = formatDateInputValue(referenceDate)

  return appointments
    .filter((appointment) => {
      const latestEntry = getLatestEntryByType(appointment, type)

      return (
        appointment.date >= today &&
        isActiveAppointment(appointment) &&
        latestEntry !== undefined &&
        new Date(latestEntry.createdAt) >= recentThreshold &&
        new Date(latestEntry.createdAt) <= referenceDate
      )
    })
    .sort((firstAppointment, secondAppointment) => {
      const firstEntry = getLatestEntryByType(firstAppointment, type)
      const secondEntry = getLatestEntryByType(secondAppointment, type)

      return (
        new Date(secondEntry?.createdAt ?? 0).getTime() -
        new Date(firstEntry?.createdAt ?? 0).getTime()
      )
    })
}

function getLatestEntryByType(
  appointment: Appointment,
  type: AppointmentChangeLogEntry['type'],
) {
  return appointment.changeLog
    ?.filter((entry) => entry.type === type)
    .sort(
      (firstEntry, secondEntry) =>
        new Date(secondEntry.createdAt).getTime() -
        new Date(firstEntry.createdAt).getTime(),
    )[0]
}

function formatAttentionDetail(appointment: Appointment) {
  return `${appointment.patient} · ${formatShortAppointmentDateTime(appointment)}`
}

function formatShortAppointmentDateTime(appointment: Appointment) {
  return `${formatShortDate(appointment.date)}, ${appointment.time}`
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`))
}

export function formatDashboardActivityDate(createdAt: string) {
  return formatAppointmentChangeLogTimestamp(createdAt)
}

function getMonthlyChangeCount(
  appointments: Appointment[],
  monthlyAppointments: Appointment[],
  type: 'cancelled' | 'rescheduled',
  referenceDate: Date,
) {
  const monthlyAppointmentIds = new Set(
    monthlyAppointments.map(({ id }) => String(id)),
  )

  return appointments.reduce((total, appointment) => {
    if ((appointment.changeLog ?? []).length === 0) {
      return (
        total +
        Number(
          appointment.status === type &&
            monthlyAppointmentIds.has(String(appointment.id)),
        )
      )
    }

    return (
      total +
      (appointment.changeLog ?? []).filter(
        (entry) =>
          entry.type === type &&
          isDateInLocalMonth(new Date(entry.createdAt), referenceDate),
      ).length
    )
  }, 0)
}

function isDateInLocalMonth(date: Date, referenceDate: Date) {
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  )
}

function isActiveAppointment(appointment: Appointment) {
  return (
    appointment.status === 'pending' ||
    appointment.status === 'confirmed' ||
    appointment.status === 'rescheduled'
  )
}

function getAppointmentDateTime(appointment: Appointment) {
  return new Date(`${appointment.date}T${appointment.time}`)
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
