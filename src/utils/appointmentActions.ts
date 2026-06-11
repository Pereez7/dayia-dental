import type { AppointmentStatus } from '../types/Appointment'

export type AppointmentStatusAction = 'cancel' | 'confirm'

export function getAppointmentStatusActions(status: AppointmentStatus) {
  const actionsByStatus: Record<AppointmentStatus, AppointmentStatusAction[]> = {
    cancelled: [],
    completed: [],
    confirmed: ['cancel'],
    pending: ['confirm', 'cancel'],
    rescheduled: ['cancel'],
  }

  return actionsByStatus[status]
}
