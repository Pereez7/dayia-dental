import type { AppointmentStatus } from '../types/Appointment'
import type { Reminder, ReminderStatusFilter } from '../types/Reminder'
import { getAppointmentStatusLabel } from './appointmentFormatters'
import { isAppointmentDateTimePast } from './reminderExpiration'
import { getReminderStatusLabel } from './reminders'
import { normalizeSearchText } from './textNormalizers'

export type ReminderAppointmentStatusFilter =
  | 'all'
  | 'past_unresolved'
  | AppointmentStatus

export function filterRemindersByAppointmentStatus(
  reminders: Reminder[],
  statusFilter: ReminderAppointmentStatusFilter,
  referenceDate = new Date(),
) {
  if (statusFilter === 'all') {
    return reminders
  }

  if (statusFilter === 'past_unresolved') {
    return reminders.filter(
      (reminder) =>
        isAppointmentDateTimePast(
          reminder.appointmentDate,
          reminder.appointmentTime,
          referenceDate,
        ) &&
        (reminder.appointmentStatus === 'pending' ||
          reminder.appointmentStatus === 'confirmed' ||
          reminder.appointmentStatus === 'rescheduled'),
    )
  }

  return reminders.filter(
    (reminder) => reminder.appointmentStatus === statusFilter,
  )
}

export function filterRemindersBySearch(
  reminders: Reminder[],
  searchTerm: string,
) {
  const normalizedSearch = normalizeSearchText(searchTerm)

  if (!normalizedSearch) {
    return reminders
  }

  return reminders.filter((reminder) =>
    normalizeSearchText(
      [reminder.patientName, reminder.phone, reminder.treatment].join(' '),
    ).includes(normalizedSearch),
  )
}

export function getReminderStateText(status: Exclude<ReminderStatusFilter, 'all'>) {
  return `Recordatorio ${getReminderStatusLabel(status).toLocaleLowerCase('es-BO')}`
}

export function getReminderAppointmentStateText(status: AppointmentStatus) {
  return `Cita ${getAppointmentStatusLabel(status).toLocaleLowerCase('es-BO')}`
}

export function getReminderEmptyStateCopy(
  hasReminders: boolean,
  statusFilter: ReminderStatusFilter,
) {
  if (!hasReminders) {
    return {
      description: 'Los nuevos recordatorios aparecerán cuando existan citas activas.',
      message: 'No hay recordatorios para mostrar.',
    }
  }

  if (statusFilter === 'all') {
    return {
      description: 'Selecciona otra fecha para continuar revisando la cola.',
      message: 'No hay recordatorios para esta fecha.',
    }
  }

  const statusLabel = getReminderStatusLabel(statusFilter).toLocaleLowerCase(
    'es-BO',
  )

  return {
    description: 'El filtro y la fecha seleccionada se mantienen activos.',
    message: `No hay recordatorios ${statusLabel}s para esta fecha.`,
  }
}
