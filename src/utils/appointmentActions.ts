import type { AppointmentId, AppointmentStatus } from '../types/Appointment'

export type AppointmentStatusAction = 'cancel' | 'confirm' | 'reschedule'

export function canRescheduleAppointment(status: AppointmentStatus) {
  return (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'rescheduled'
  )
}

export function getAppointmentStatusActions(status: AppointmentStatus) {
  const actionsByStatus: Record<AppointmentStatus, AppointmentStatusAction[]> = {
    cancelled: [],
    completed: [],
    confirmed: ['reschedule', 'cancel'],
    pending: ['confirm', 'reschedule', 'cancel'],
    rescheduled: ['reschedule', 'cancel'],
  }

  return actionsByStatus[status]
}

export function shouldCloseReschedulePanelAfterStatusChange(
  activeRescheduleAppointmentId: AppointmentId | null,
  appointmentId: AppointmentId,
  status: AppointmentStatus,
) {
  return (
    status === 'cancelled' &&
    activeRescheduleAppointmentId === appointmentId
  )
}

export function shouldCloseReschedulePanelOnToggle(
  activeRescheduleAppointmentId: AppointmentId | null,
  appointmentId: AppointmentId,
) {
  return activeRescheduleAppointmentId === appointmentId
}
