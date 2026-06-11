import type { Appointment, AppointmentStatus } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import { generateBusinessTimeSlotsForDate } from './businessHours'

interface AvailableTimeOptionsConfig {
  appointmentIdToIgnore?: number
  excludePastTimes?: boolean
  referenceDate?: Date
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
  appointmentIdToIgnore?: number,
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

export function hasPatientAppointmentOnDate(
  appointments: Appointment[],
  patientId: number | null,
  date: string,
  appointmentIdToIgnore?: number,
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
  configOrAppointmentId?: AvailableTimeOptionsConfig | number,
) {
  if (!date) {
    return []
  }

  const config =
    typeof configOrAppointmentId === 'number'
      ? { appointmentIdToIgnore: configOrAppointmentId }
      : configOrAppointmentId
  const referenceDate = config?.referenceDate ?? new Date()

  return generateBusinessTimeSlotsForDate(businessHours, date).filter(
    (slot) =>
      !hasAppointmentConflict(
        appointments,
        date,
        slot.value,
        config?.appointmentIdToIgnore,
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
