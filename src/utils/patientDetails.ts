import type { Appointment } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import { sortAppointmentsByDateTime } from './appointmentSorters'

export function calculatePatientAge(
  birthDate: string,
  referenceDate = new Date(),
) {
  const birth = new Date(`${birthDate}T00:00:00`)
  let age = referenceDate.getFullYear() - birth.getFullYear()
  const hasNotHadBirthdayThisYear =
    referenceDate.getMonth() < birth.getMonth() ||
    (referenceDate.getMonth() === birth.getMonth() &&
      referenceDate.getDate() < birth.getDate())

  if (hasNotHadBirthdayThisYear) {
    age -= 1
  }

  return age
}

export function getPatientAppointments(
  patient: Patient,
  appointments: Appointment[],
) {
  return sortAppointmentsByDateTime(
    appointments.filter((appointment) => {
      if (appointment.patientId !== undefined) {
        return appointment.patientId === patient.id
      }

      return appointment.patient === patient.fullName
    }),
  )
}

export function getUpcomingPatientAppointments(
  patient: Patient,
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return getPatientAppointments(patient, appointments).filter(
    (appointment) => appointment.date >= today,
  )
}

export function getActivePatientAppointments(
  patient: Patient,
  appointments: Appointment[],
) {
  return getPatientAppointments(patient, appointments).filter(
    (appointment) =>
      appointment.status === 'pending' ||
      appointment.status === 'confirmed' ||
      appointment.status === 'rescheduled',
  )
}

export function getNextActivePatientAppointment(
  patient: Patient,
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return getActivePatientAppointments(patient, appointments).find(
    (appointment) => appointment.date >= today,
  )
}

export function getUpcomingActivePatientAppointments(
  patient: Patient,
  appointments: Appointment[],
  referenceDate = new Date(),
) {
  const today = formatDateInputValue(referenceDate)

  return getActivePatientAppointments(patient, appointments).filter(
    (appointment) => appointment.date >= today,
  )
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
