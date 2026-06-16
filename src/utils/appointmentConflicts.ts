import type {
  Appointment,
  AppointmentId,
  AppointmentStatus,
} from '../types/Appointment'
import type {
  BusinessHoursSettings,
  CalendarException,
} from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import type { PatientId } from '../types/Patient'
import {
  generateBusinessTimeSlotsForDate,
  getEffectiveBusinessHoursForDate,
  isValidBusinessTimeFormat,
} from './businessHours'
import {
  doesAppointmentFitBusinessHours,
  getAppointmentDuration,
  getAppointmentEndTime,
} from './appointmentDuration'
import { defaultTreatmentDurationMinutes } from './treatmentUtils'

interface AvailableTimeOptionsConfig {
  appointmentIdToIgnore?: AppointmentId
  excludePastTimes?: boolean
  referenceDate?: Date
  treatments?: Treatment[]
  calendarExceptions?: CalendarException[]
}

export interface AppointmentTimeRange {
  date: string
  endMinutes: number
  endTime: string
  startMinutes: number
  startTime: string
}

const blockingAppointmentStatuses: AppointmentStatus[] = [
  'confirmed',
  'pending',
  'rescheduled',
]

export function hasAppointmentConflict(
  appointments: Appointment[],
  date: string,
  time: string,
  appointmentIdToIgnore?: AppointmentId,
) {
  if (!date || !time) {
    return false
  }

  return appointments.some((appointment) => {
    if (appointment.id === appointmentIdToIgnore) {
      return false
    }

    return (
      appointment.date === date &&
      appointment.time === time &&
      blockingAppointmentStatuses.includes(appointment.status)
    )
  })
}

export function getAppointmentTimeRange(
  date: string,
  time: string,
  durationMinutes: number,
): AppointmentTimeRange | null {
  if (
    !date ||
    !isValidBusinessTimeFormat(time) ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null
  }

  const endTime = getAppointmentEndTime(time, durationMinutes)

  if (!endTime) {
    return null
  }

  return {
    date,
    endMinutes: getTimeAsMinutes(time) + durationMinutes,
    endTime,
    startMinutes: getTimeAsMinutes(time),
    startTime: time,
  }
}

export function doTimeRangesOverlap(
  firstRange: AppointmentTimeRange,
  secondRange: AppointmentTimeRange,
) {
  if (firstRange.date !== secondRange.date) {
    return false
  }

  return (
    firstRange.startMinutes < secondRange.endMinutes &&
    firstRange.endMinutes > secondRange.startMinutes
  )
}

export function hasAppointmentDurationConflict(
  appointments: Appointment[],
  date: string,
  time: string,
  durationMinutes: number,
  configOrAppointmentId?: AvailableTimeOptionsConfig | AppointmentId,
) {
  const config =
    typeof configOrAppointmentId === 'number' ||
    typeof configOrAppointmentId === 'string'
      ? { appointmentIdToIgnore: configOrAppointmentId }
      : configOrAppointmentId
  const targetRange = getAppointmentTimeRange(date, time, durationMinutes)

  if (!targetRange) {
    return false
  }

  return appointments.some((appointment) => {
    if (appointment.id === config?.appointmentIdToIgnore) {
      return false
    }

    if (
      appointment.date !== date ||
      !blockingAppointmentStatuses.includes(appointment.status)
    ) {
      return false
    }

    const appointmentRange = getAppointmentTimeRange(
      appointment.date,
      appointment.time,
      getAppointmentDuration(appointment, config?.treatments),
    )

    return appointmentRange
      ? doTimeRangesOverlap(targetRange, appointmentRange)
      : false
  })
}

export function hasPatientAppointmentOnDate(
  appointments: Appointment[],
  patientId: PatientId | null,
  date: string,
  appointmentIdToIgnore?: AppointmentId,
) {
  if (patientId === null || !date) {
    return false
  }

  return appointments.some((appointment) => {
    if (appointment.id === appointmentIdToIgnore) {
      return false
    }

    return (
      appointment.patientId === patientId &&
      appointment.date === date &&
      blockingAppointmentStatuses.includes(appointment.status)
    )
  })
}

export function getAvailableTimeOptions(
  businessHours: BusinessHoursSettings,
  appointments: Appointment[],
  date: string,
  configOrAppointmentId?: AvailableTimeOptionsConfig | AppointmentId,
) {
  return getAvailableTimeOptionsByDuration(
    businessHours,
    appointments,
    date,
    defaultTreatmentDurationMinutes,
    configOrAppointmentId,
  )
}

export function getAvailableTimeOptionsByDuration(
  businessHours: BusinessHoursSettings,
  appointments: Appointment[],
  date: string,
  durationMinutes: number,
  configOrAppointmentId?: AvailableTimeOptionsConfig | AppointmentId,
) {
  if (!date) {
    return []
  }

  const config =
    typeof configOrAppointmentId === 'number' ||
    typeof configOrAppointmentId === 'string'
      ? { appointmentIdToIgnore: configOrAppointmentId }
      : configOrAppointmentId
  const referenceDate = config?.referenceDate ?? new Date()
  const daySchedule = getEffectiveBusinessHoursForDate(
    businessHours,
    date,
    config?.calendarExceptions,
  )

  return generateBusinessTimeSlotsForDate(
    businessHours,
    date,
    config?.calendarExceptions,
  ).filter(
    (slot) =>
      doesAppointmentFitBusinessHours(daySchedule, slot.value, durationMinutes) &&
      !hasAppointmentDurationConflict(
        appointments,
        date,
        slot.value,
        durationMinutes,
        config,
      ) &&
      !(
        config?.excludePastTimes &&
        isPastTimeForDate(date, slot.value, referenceDate)
      ),
  )
}

export function isPastTimeForDate(
  date: string,
  time: string,
  referenceDate = new Date(),
) {
  if (!date || !time) {
    return false
  }

  const selectedDateTime = new Date(`${date}T${time}:00`)
  const referenceDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const selectedDay = new Date(`${date}T00:00:00`)

  if (selectedDay.getTime() !== referenceDay.getTime()) {
    return false
  }

  return selectedDateTime <= referenceDate
}

function getTimeAsMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':')

  return Number(hours) * 60 + Number(minutes)
}
