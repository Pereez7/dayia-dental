import type {
  Appointment,
  AppointmentChangeLogEntry,
  AppointmentChangeLogType,
} from '../types/Appointment'
import type { AppointmentReasonPayload } from './appointmentReasons'

type AppointmentChangeLogMetadata = Record<string, string>

export function createAppointmentLogEntry(
  type: AppointmentChangeLogType,
  description: string,
  metadata?: AppointmentChangeLogMetadata,
  createdAt = new Date(),
): AppointmentChangeLogEntry {
  const createdAtIso = createdAt.toISOString()

  return {
    id: `${createdAtIso}-${type}`,
    type,
    createdAt: createdAtIso,
    description,
    ...(metadata ? { metadata } : {}),
  }
}

export function appendAppointmentLogEntry(
  appointment: Appointment,
  entry: AppointmentChangeLogEntry,
): Appointment {
  return {
    ...appointment,
    changeLog: [...(appointment.changeLog ?? []), entry],
  }
}

export function createAppointmentCreatedLog(
  appointment: Pick<Appointment, 'date' | 'time'>,
  createdAt = new Date(),
) {
  return createAppointmentLogEntry(
    'created',
    `Cita creada para el ${formatAppointmentScheduleText(
      appointment.date,
      appointment.time,
    )}.`,
    {
      date: appointment.date,
      time: appointment.time,
    },
    createdAt,
  )
}

export function createAppointmentConfirmedLog(createdAt = new Date()) {
  return createAppointmentLogEntry(
    'confirmed',
    'Cita confirmada.',
    undefined,
    createdAt,
  )
}

export function createAppointmentCancelledLog(
  reasonPayload?: AppointmentReasonPayload,
  createdAt = new Date(),
) {
  const reason = getAppointmentReasonText(reasonPayload)

  return createAppointmentLogEntry(
    'cancelled',
    `Cita cancelada. Motivo: ${reason}.`,
    {
      reason,
    },
    createdAt,
  )
}

export function createAppointmentRescheduledLog(
  appointment: Pick<Appointment, 'date' | 'time'>,
  nextValues: Pick<Appointment, 'date' | 'time'>,
  reasonPayload?: AppointmentReasonPayload,
  createdAt = new Date(),
) {
  const reason = getAppointmentReasonText(reasonPayload)

  return createAppointmentLogEntry(
    'rescheduled',
    `Cita reprogramada del ${formatAppointmentScheduleText(
      appointment.date,
      appointment.time,
    )} al ${formatAppointmentScheduleText(
      nextValues.date,
      nextValues.time,
    )}. Motivo: ${reason}.`,
    {
      fromDate: appointment.date,
      fromTime: appointment.time,
      reason,
      toDate: nextValues.date,
      toTime: nextValues.time,
    },
    createdAt,
  )
}

export function getLatestAppointmentLogEntry(appointment: Appointment) {
  return appointment.changeLog?.at(-1)
}

export function getAppointmentLogDisplayText(entry: AppointmentChangeLogEntry) {
  if (entry.type === 'rescheduled') {
    const fromDate = entry.metadata?.fromDate
    const fromTime = entry.metadata?.fromTime
    const toDate = entry.metadata?.toDate
    const toTime = entry.metadata?.toTime

    if (fromDate && fromTime && toDate && toTime) {
      return `Reprogramada de ${formatAppointmentChangeLogSchedule(
        fromDate,
        fromTime,
      )} a ${formatAppointmentChangeLogSchedule(toDate, toTime)}.`
    }
  }

  if (entry.type === 'cancelled') {
    return 'Cancelada.'
  }

  if (entry.type === 'confirmed') {
    return 'Confirmada.'
  }

  if (entry.type === 'created') {
    const date = entry.metadata?.date
    const time = entry.metadata?.time

    if (date && time) {
      return `Creada para ${formatAppointmentChangeLogSchedule(date, time)}.`
    }
  }

  return entry.description
}

export function getAppointmentLogSummary(entry: AppointmentChangeLogEntry) {
  return `Ultimo cambio ${formatAppointmentChangeLogTimestamp(
    entry.createdAt,
  )}: ${getAppointmentLogDisplayText(entry)}`
}

export function formatAppointmentChangeLogTimestamp(createdAt: string) {
  const date = new Date(createdAt)

  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function formatAppointmentChangeLogSchedule(date: string, time: string) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`))

  return `${formattedDate}, ${time}`
}

function formatAppointmentScheduleText(date: string, time: string) {
  const formattedDate = new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T00:00:00`))

  return `${formattedDate} a las ${time}`
}

function getAppointmentReasonText(reasonPayload?: AppointmentReasonPayload) {
  return reasonPayload?.reasonDetail || reasonPayload?.reason || 'Sin motivo registrado'
}
