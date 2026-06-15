import type { Appointment } from '../types/Appointment'
import type { BusinessDaySchedule } from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'
import { isValidBusinessTimeFormat } from './businessHours'
import {
  defaultTreatmentDurationMinutes,
  getTreatmentDuration,
} from './treatmentUtils'

export function getAppointmentDuration(
  appointment: Pick<Appointment, 'durationMinutes' | 'treatment'>,
  treatments: Treatment[] = [],
) {
  if (
    Number.isFinite(appointment.durationMinutes) &&
    appointment.durationMinutes &&
    appointment.durationMinutes > 0
  ) {
    return appointment.durationMinutes
  }

  return getTreatmentDuration(
    treatments,
    appointment.treatment,
    defaultTreatmentDurationMinutes,
  )
}

export function getAppointmentEndTime(startTime: string, durationMinutes: number) {
  if (!isValidBusinessTimeFormat(startTime) || durationMinutes <= 0) {
    return ''
  }

  return formatMinutesAsTime(getTimeAsMinutes(startTime) + durationMinutes)
}

export function doesAppointmentFitBusinessHours(
  daySchedule: BusinessDaySchedule | undefined,
  startTime: string,
  durationMinutes: number,
) {
  if (!daySchedule?.isOpen) {
    return false
  }

  if (
    !isValidBusinessTimeFormat(startTime) ||
    !isValidBusinessTimeFormat(daySchedule.endTime) ||
    durationMinutes <= 0
  ) {
    return false
  }

  const appointmentEndMinutes = getTimeAsMinutes(startTime) + durationMinutes

  return appointmentEndMinutes <= getTimeAsMinutes(daySchedule.endTime)
}

export function formatAppointmentTimeRange(
  startTime: string,
  durationMinutes: number,
) {
  const endTime = getAppointmentEndTime(startTime, durationMinutes)

  if (!endTime) {
    return startTime
  }

  return `${startTime} - ${endTime}`
}

function getTimeAsMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':')

  return Number(hours) * 60 + Number(minutes)
}

function formatMinutesAsTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
