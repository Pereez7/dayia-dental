export type AppointmentStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'rescheduled'

export type AppointmentChangeLogType =
  | 'cancelled'
  | 'confirmed'
  | 'created'
  | 'rescheduled'

export interface AppointmentChangeLogEntry {
  id: string
  type: AppointmentChangeLogType
  createdAt: string
  description: string
  metadata?: Record<string, string>
}

export interface Appointment {
  id: number
  patientId?: number
  cancellationReason?: string
  cancellationReasonDetail?: string
  changeLog?: AppointmentChangeLogEntry[]
  date: string
  time: string
  patient: string
  rescheduleReason?: string
  rescheduleReasonDetail?: string
  treatment: string
  status: AppointmentStatus
}

export interface AppointmentFormValues {
  patientId: number | null
  patient: string
  date: string
  time: string
  treatment: string
  status: AppointmentStatus
}

export type AppointmentFormErrors = Partial<
  Record<keyof AppointmentFormValues, string>
>
