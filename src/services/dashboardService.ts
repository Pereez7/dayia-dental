import { supabase } from '../lib/supabaseClient'
import type {
  Appointment,
  AppointmentChangeLogEntry,
  AppointmentStatus,
} from '../types/Appointment'
import type { Patient } from '../types/Patient'
import {
  getAppointmentsRequiringAttention,
  getRecentAppointmentActivity,
  type DashboardSnapshot,
  type DashboardSummary,
} from '../utils/dashboardMetrics'

const appointmentStatuses = new Set<AppointmentStatus>([
  'cancelled',
  'completed',
  'confirmed',
  'no_show',
  'pending',
  'rescheduled',
])

export async function getDashboardSnapshot(
  clinicId: string,
  referenceDate = new Date(),
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const dashboardRpcClient = supabase as unknown as {
    rpc: (
      functionName: 'get_clinic_dashboard_snapshot',
      args: {
        target_clinic_id: string
        target_reference_date: string
        target_reference_time: string
      },
    ) => PromiseLike<{ data: unknown; error: unknown }>
  }
  const { data, error } = await dashboardRpcClient.rpc(
    'get_clinic_dashboard_snapshot',
    {
      target_clinic_id: clinicId,
      target_reference_date: formatLocalDate(referenceDate),
      target_reference_time: formatLocalTime(referenceDate),
    },
  )

  if (error) {
    return { data: null, error: getDashboardServiceErrorMessage(error) }
  }

  const snapshot = parseDashboardSnapshot(data, referenceDate)

  if (!snapshot) {
    return {
      data: null,
      error: 'No pudimos interpretar el resumen del consultorio.',
    }
  }

  return { data: snapshot, error: null }
}

export function parseDashboardSnapshot(
  value: unknown,
  referenceDate = new Date(),
): DashboardSnapshot | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const summary = parseDashboardSummary(record.summary)
  const upcomingAppointments = parseAppointments(record.upcomingAppointments)
  const attentionAppointments = parseAppointments(record.attentionAppointments)
  const recentActivityAppointments = parseAppointments(
    record.recentActivityAppointments,
  )
  const recentPatients = parsePatients(record.recentPatients)

  if (
    !summary ||
    !upcomingAppointments ||
    !attentionAppointments ||
    !recentActivityAppointments ||
    !recentPatients
  ) {
    return null
  }

  return {
    attentionItems: getAppointmentsRequiringAttention(
      attentionAppointments,
      5,
      referenceDate,
    ),
    recentActivity: getRecentAppointmentActivity(
      recentActivityAppointments,
      5,
    ),
    recentPatients,
    summary,
    upcomingAppointments,
  }
}

function parseDashboardSummary(value: unknown): DashboardSummary | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const keys = [
    'monthlyCancelledAppointments',
    'monthlyRescheduledAppointments',
    'registeredPatients',
    'todayAppointments',
    'todayConfirmedAppointments',
    'todayPendingAppointments',
  ] as const

  if (keys.some((key) => !isNonNegativeInteger(record[key]))) {
    return null
  }

  return {
    monthlyCancelledAppointments:
      record.monthlyCancelledAppointments as number,
    monthlyRescheduledAppointments:
      record.monthlyRescheduledAppointments as number,
    registeredPatients: record.registeredPatients as number,
    todayAppointments: record.todayAppointments as number,
    todayConfirmedAppointments: record.todayConfirmedAppointments as number,
    todayPendingAppointments: record.todayPendingAppointments as number,
  }
}

function parseAppointments(value: unknown): Appointment[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const appointments = value.map(parseAppointment)

  return appointments.every(
    (appointment): appointment is Appointment => appointment !== null,
  )
    ? appointments
    : null
}

function parseAppointment(value: unknown): Appointment | null {
  const record = asRecord(value)

  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.date !== 'string' ||
    typeof record.durationMinutes !== 'number' ||
    typeof record.patient !== 'string' ||
    typeof record.patientId !== 'string' ||
    typeof record.status !== 'string' ||
    !appointmentStatuses.has(record.status as AppointmentStatus) ||
    typeof record.time !== 'string' ||
    typeof record.treatment !== 'string'
  ) {
    return null
  }

  const changeLog = parseChangeLog(record.changeLog)

  if (changeLog === null) {
    return null
  }

  return {
    changeLog,
    date: record.date,
    durationMinutes: record.durationMinutes,
    id: record.id,
    patient: record.patient,
    patientId: record.patientId,
    status: record.status as AppointmentStatus,
    time: record.time,
    treatment: record.treatment,
  }
}

function parseChangeLog(value: unknown): AppointmentChangeLogEntry[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  const entries = value.map((item): AppointmentChangeLogEntry | null => {
    const record = asRecord(item)

    if (
      !record ||
      typeof record.createdAt !== 'string' ||
      typeof record.description !== 'string' ||
      typeof record.id !== 'string' ||
      typeof record.type !== 'string'
    ) {
      return null
    }

    const metadata = asRecord(record.metadata) ?? {}

    return {
      createdAt: record.createdAt,
      description: record.description,
      id: record.id,
      metadata: Object.fromEntries(
        Object.entries(metadata).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
      type: record.type as AppointmentChangeLogEntry['type'],
    }
  })

  return entries.every(
    (entry): entry is AppointmentChangeLogEntry => entry !== null,
  )
    ? entries
    : null
}

function parsePatients(value: unknown): Patient[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const patients = value.map((item): Patient | null => {
    const record = asRecord(item)

    if (
      !record ||
      typeof record.fullName !== 'string' ||
      typeof record.id !== 'string' ||
      typeof record.lastVisit !== 'string' ||
      typeof record.phone !== 'string'
    ) {
      return null
    }

    return {
      ...(typeof record.birthDate === 'string'
        ? { birthDate: record.birthDate }
        : {}),
      ...(typeof record.countryCode === 'string'
        ? { countryCode: record.countryCode }
        : {}),
      ...(typeof record.email === 'string' ? { email: record.email } : {}),
      ...(typeof record.firstName === 'string'
        ? { firstName: record.firstName }
        : {}),
      fullName: record.fullName,
      id: record.id,
      ...(typeof record.lastName === 'string'
        ? { lastName: record.lastName }
        : {}),
      lastVisit: record.lastVisit,
      nextAppointment:
        typeof record.nextAppointment === 'string'
          ? record.nextAppointment
          : null,
      phone: record.phone,
      status: 'active',
    }
  })

  return patients.every((patient): patient is Patient => patient !== null)
    ? patients
    : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatLocalTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
}

function getDashboardServiceErrorMessage(error?: { code?: string }) {
  if (error?.code === '42501') {
    return 'No tienes permiso para consultar este Dashboard.'
  }

  return 'No pudimos cargar el resumen del consultorio.'
}
