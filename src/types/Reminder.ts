export type ReminderType = '24h' | '2h' | 'immediate'

export type ReminderStatus = 'pending' | 'scheduled' | 'sent' | 'failed'

export type ReminderStatusFilter = 'all' | ReminderStatus

export interface Reminder {
  id: string
  appointmentId: number
  patientId: number | null
  patientName: string
  phone: string
  appointmentDate: string
  appointmentTime: string
  treatment: string
  reminderType: ReminderType
  scheduledFor: string
  status: ReminderStatus
  message: string
  omittedReminderNotes?: string[]
}

export type ReminderSummary = Record<ReminderStatus, number>

export interface ReminderAppointmentGroup {
  appointmentDate: string
  appointmentId: number
  appointmentTime: string
  patientId: number | null
  patientName: string
  phone: string
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
