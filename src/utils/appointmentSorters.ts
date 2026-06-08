import type { Appointment } from '../types/Appointment'

export function sortAppointmentsByDateTime(appointments: Appointment[]) {
  return [...appointments].sort((firstAppointment, secondAppointment) => {
    const firstDateTime = `${firstAppointment.date}T${firstAppointment.time}`
    const secondDateTime = `${secondAppointment.date}T${secondAppointment.time}`

    return firstDateTime.localeCompare(secondDateTime)
  })
}
