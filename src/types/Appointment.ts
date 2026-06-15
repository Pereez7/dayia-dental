import type { PatientId } from './Patient'

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
  patientId?: PatientId
  cancellationReason?: string
  cancellationReasonDetail?: string
  changeLog?: AppointmentChangeLogEntry[]
  date: string
  durationMinutes?: number
  time: string
  patient: string
  rescheduleReason?: string
  rescheduleReasonDetail?: string
  treatment: string
  status: AppointmentStatus
}

export interface AppointmentFormValues {
  patientId: PatientId | null
  patient: string
  date: string
  durationMinutes: number
  time: string
  treatment: string
  status: AppointmentStatus
}

export type AppointmentFormErrors = Partial<
  Record<keyof AppointmentFormValues, string>
>
