import type { AppointmentId, AppointmentStatus } from './Appointment'
import type { PatientId } from './Patient'

export type ReminderType = '24h' | '2h' | 'immediate'

export type ReminderStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'skipped'

export type ReminderStatusFilter = 'all' | ReminderStatus

export interface Reminder {
  id: string
  appointmentId: AppointmentId
  patientId: PatientId | null
  patientName: string
  phone: string
  appointmentDate: string
  appointmentStatus: AppointmentStatus
  appointmentTime: string
  treatment: string
  rescheduleReason?: string
  rescheduleReasonDetail?: string
  reminderType: ReminderType
  scheduledFor: string
  sentAt?: string
  failedReason?: string
  status: ReminderStatus
  statusNote?: string
  message: string
  omittedReminderNotes?: string[]
}

export type ReminderSummary = Record<ReminderStatus, number>

export interface ReminderAppointmentGroup {
  appointmentDate: string
  appointmentId: AppointmentId
  appointmentStatus: AppointmentStatus
  appointmentTime: string
  patientId: PatientId | null
  patientName: string
  phone: string
  rescheduleReason?: string
  rescheduleReasonDetail?: string
  omittedReminderNotes: string[]
  reminders: Reminder[]
  treatment: string
}

export interface ReminderDateGroup {
  appointmentDate: string
  appointmentGroups: ReminderAppointmentGroup[]
  label: string
}

export interface ReminderDateOption {
  appointmentDate: string
  dateLabel: string
  fullLabel: string
  weekdayLabel: string
}
