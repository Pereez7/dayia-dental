import type { AppointmentStatus } from '../types/Appointment'

export type AppointmentStatusAction = 'cancel' | 'confirm' | 'reschedule'

export const appointmentCancellationConfirmationMessage =
  '¿Seguro que deseas cancelar esta cita? Esta acción liberará el horario.'

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
  activeRescheduleAppointmentId: number | null,
  appointmentId: number,
  status: AppointmentStatus,
) {
  return (
    status === 'cancelled' &&
    activeRescheduleAppointmentId === appointmentId
  )
}

export function shouldCloseReschedulePanelOnToggle(
  activeRescheduleAppointmentId: number | null,
  appointmentId: number,
) {
  return activeRescheduleAppointmentId === appointmentId
}

export function shouldCancelAppointment(
  confirmCancellation: (message: string) => boolean,
) {
  return confirmCancellation(appointmentCancellationConfirmationMessage)
}
