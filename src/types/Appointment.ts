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

export interface AppointmentFormValues {
  patient: string
  date: string
  time: string
  treatment: string
  status: AppointmentStatus
}

export type AppointmentFormErrors = Partial<
  Record<keyof AppointmentFormValues, string>
>
