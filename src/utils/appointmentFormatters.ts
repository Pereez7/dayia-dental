import type { AppointmentStatus } from '../types/Appointment'

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  cancelled: 'Cancelada',
  completed: 'Atendida',
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  rescheduled: 'Reprogramada',
}

const appointmentStatusClassNames: Record<AppointmentStatus, string> = {
  cancelled: 'appointment-status--cancelled',
  completed: 'appointment-status--completed',
  confirmed: 'appointment-status--confirmed',
  pending: 'appointment-status--pending',
  rescheduled: 'appointment-status--rescheduled',
}

export function formatAppointmentDate(date: string) {
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`))
}

export function formatAppointmentTime(time: string) {
  return time
}

export function getAppointmentStatusLabel(status: AppointmentStatus) {
  return appointmentStatusLabels[status]
}

export function getAppointmentStatusClassName(status: AppointmentStatus) {
  return appointmentStatusClassNames[status]
}
