import type { Appointment, AppointmentStatus } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import { generateBusinessTimeSlotsForDate } from './businessHours'

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
  appointmentIdToIgnore?: number,
) {
  if (!date) {
    return []
  }

  return generateBusinessTimeSlotsForDate(businessHours, date).filter(
    (slot) =>
      !hasAppointmentConflict(
        appointments,
        date,
        slot.value,
        appointmentIdToIgnore,
      ),
  )
}
