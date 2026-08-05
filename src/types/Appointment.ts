import type { PatientId } from './Patient'

export type AppointmentId = number | string

export type AppointmentStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'rescheduled'

export type AppointmentChangeLogType =
  | 'cancelled'
  | 'confirmed'
  | 'created'
  | 'completed'
  | 'no_show'
  | 'rescheduled'

export interface AppointmentChangeLogEntry {
  id: AppointmentId
  type: AppointmentChangeLogType
  createdAt: string
  description: string
  metadata?: Record<string, string>
}

export interface Appointment {
  id: AppointmentId
  patientId?: PatientId
  cancellationReason?: string
  cancellationReasonDetail?: string
  changeLog?: AppointmentChangeLogEntry[]
  date: string
  durationMinutes?: number
  time: string
  patient: string
  patientPhone?: string
  rescheduleReason?: string
  rescheduleReasonDetail?: string
  treatment: string
  status: AppointmentStatus
}

export interface AppointmentAgendaCursor {
  id: string
  startTime: string
}

export interface AppointmentStatusSummary {
  cancelled: number
  completed: number
  confirmed: number
  no_show: number
  pending: number
  rescheduled: number
  total: number
}

export interface AppointmentAgendaSnapshot {
  appointments: Appointment[]
  availabilityAppointments: Appointment[]
  dayOptions: string[]
  pageInfo: {
    hasMore: boolean
    nextCursor: AppointmentAgendaCursor | null
  }
  selectedDate: string
  statusSummary: AppointmentStatusSummary
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
