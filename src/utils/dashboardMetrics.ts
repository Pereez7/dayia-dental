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
    registeredPatients: patients.length,
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
    appointments.filter((appointment) => appointment.date === today),
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
        appointment.status !== 'cancelled' &&
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
    cancelled: statusSummary.cancelled,
    confirmed: statusSummary.confirmed,
    rescheduled: statusSummary.rescheduled,
    total: monthlyAppointments.length,
  }
}

export function getRecentPatients(patients: Patient[], limit = 4) {
  return patients.slice(0, limit)
}

export function getAppointmentsRequiringAttention(
  appointments: Appointment[],
  patients: Patient[],
  limit = 5,
  referenceDate = new Date(),
): DashboardAttentionItem[] {
  const upcomingAppointments = getUpcomingAppointments(
    appointments,
    appointments.length,
    referenceDate,
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

    const patient = getAppointmentPatient(appointment, patients)

    if (patient && !patient.phone) {
      attentionItems.push({
        detail: `${appointment.patient} · sin telefono registrado`,
        id: `phone-${appointment.id}`,
        label: 'Revisar telefono',
        tone: 'red',
      })
    }
  }

  for (const appointment of getRecentlyChangedAppointments(
    appointments,
    'rescheduled',
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
      (appointment.changeLog ?? [])
        .filter((entry) => entry.type !== 'created')
        .map((entry) => createActivityItem(appointment, entry)),
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

  return entry.description.replace(/\.$/, '')
}

function getRecentlyChangedAppointments(
  appointments: Appointment[],
  type: AppointmentChangeLogEntry['type'],
) {
  return appointments
    .filter((appointment) =>
      appointment.changeLog?.some((entry) => entry.type === type),
    )
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

function getAppointmentPatient(appointment: Appointment, patients: Patient[]) {
  if (appointment.patientId !== undefined) {
    return patients.find((patient) => patient.id === appointment.patientId)
  }

  return patients.find((patient) => patient.fullName === appointment.patient)
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
