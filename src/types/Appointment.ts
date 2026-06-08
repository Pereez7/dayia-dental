export type AppointmentStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'rescheduled'

export interface Appointment {
  id: number
  date: string
  time: string
  patient: string
  treatment: string
  status: AppointmentStatus
}
