import type { AppointmentStatus } from '../data/appointments'

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  reminder: 'Recordatorio',
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
