export type Json =
  | boolean
  | null
  | number
  | string
  | Json[]
  | { [key: string]: Json | undefined }

export type ClinicRole = 'admin' | 'dentist' | 'reception'

export type AppointmentRecordStatus =
  | 'cancelled'
  | 'confirmed'
  | 'pending'
  | 'rescheduled'

export type AppointmentChangeLogRecordType =
  | 'cancelled'
  | 'confirmed'
  | 'created'
  | 'rescheduled'

export type CalendarExceptionRecordType = 'closed' | 'special-hours'

export type ReminderRecordChannel = 'whatsapp'

export type ReminderRecordStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'skipped'

export type ReminderRecordType = '24h' | '2h' | 'immediate'

export interface Clinic {
  country_code: string
  created_at: string
  id: string
  name: string
  phone: string | null
  updated_at: string
}

export interface UserProfile {
  clinic_id: string | null
  created_at: string
  full_name: string | null
  id: string
  role: ClinicRole | string | null
  updated_at: string
}

export type ClinicProfile = UserProfile

export interface PatientRecord {
  birth_date: string | null
  clinic_id: string
  country_code: string
  created_at: string
  email: string | null
  first_name: string
  id: string
  last_name: string
  notes: string | null
  phone: string
  updated_at: string
}

export interface TreatmentRecord {
  clinic_id: string
  created_at: string
  duration_minutes: number
  id: string
  is_active: boolean
  name: string
  updated_at: string
}

export interface BusinessHourRecord {
  clinic_id: string
  created_at: string
  end_time: string | null
  id: string
  is_open: boolean
  slot_interval_minutes: number
  start_time: string | null
  updated_at: string
  weekday: number
}

export interface CalendarExceptionRecord {
  clinic_id: string
  created_at: string
  date: string
  end_time: string | null
  id: string
  reason: string | null
  reason_detail: string | null
  start_time: string | null
  type: CalendarExceptionRecordType
  updated_at: string
}

export interface AppointmentRecord {
  appointment_date: string
  cancel_reason: string | null
  clinic_id: string
  created_at: string
  duration_minutes: number
  id: string
  patient_id: string
  reason: string | null
  reschedule_reason: string | null
  start_time: string
  status: AppointmentRecordStatus
  treatment_id: string | null
  updated_at: string
}

export interface AppointmentChangeLogRecord {
  appointment_id: string
  clinic_id: string
  created_at: string
  description: string | null
  from_date: string | null
  from_time: string | null
  id: string
  to_date: string | null
  to_time: string | null
  type: AppointmentChangeLogRecordType | string
}

export interface ReminderRecord {
  appointment_id: string
  channel: ReminderRecordChannel
  clinic_id: string
  created_at: string
  delivered_at: string | null
  failed_reason: string | null
  id: string
  message: string
  metadata: Json | null
  patient_id: string
  provider_message_id: string | null
  read_at: string | null
  reminder_type: ReminderRecordType
  scheduled_at: string
  sent_at: string | null
  status: ReminderRecordStatus
  updated_at: string
}

export interface WhatsAppSettingsRecord {
  business_account_id: string | null
  clinic_id: string
  created_at: string
  id: string
  is_connected: boolean
  phone_number: string | null
  phone_number_id: string | null
  provider: string | null
  updated_at: string
}

export type TableRowMap = {
  appointment_change_logs: AppointmentChangeLogRecord
  appointments: AppointmentRecord
  business_hours: BusinessHourRecord
  calendar_exceptions: CalendarExceptionRecord
  clinics: Clinic
  patients: PatientRecord
  profiles: UserProfile
  reminders: ReminderRecord
  treatments: TreatmentRecord
  whatsapp_settings: WhatsAppSettingsRecord
}

type Insertable<T extends { created_at: string; id: string; updated_at?: string }> =
  Omit<T, 'created_at' | 'id' | 'updated_at'> & {
    created_at?: string
    id?: string
    updated_at?: string
  }

type Updatable<T> = Partial<Omit<T, 'created_at' | 'id'>>

export type Database = {
  public: {
    CompositeTypes: Record<string, never>
    Enums: Record<string, never>
    Functions: Record<string, never>
    Tables: {
      [TableName in keyof TableRowMap]: {
        Insert: Insertable<TableRowMap[TableName]>
        Relationships: []
        Row: TableRowMap[TableName]
        Update: Updatable<TableRowMap[TableName]>
      }
    }
    Views: Record<string, never>
  }
}
