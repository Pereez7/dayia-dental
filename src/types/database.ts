export type Json =
  | boolean
  | null
  | number
  | string
  | Json[]
  | { [key: string]: Json | undefined }

export type KnownUserRole =
  | 'clinic_owner'
  | 'clinic_admin'
  | 'doctor'
  | 'platform_admin'
  | 'receptionist'

export type UnknownRole = 'unknown'

export type UserRole = KnownUserRole | UnknownRole

export type LegacyUserRole = 'admin' | 'owner' | 'super_admin'

export type AppointmentRecordStatus =
  | 'cancelled'
  | 'completed'
  | 'confirmed'
  | 'no_show'
  | 'pending'
  | 'rescheduled'

export type AppointmentChangeLogRecordType =
  | 'cancelled'
  | 'completed'
  | 'confirmed'
  | 'created'
  | 'no_show'
  | 'rescheduled'

export type CalendarExceptionRecordType = 'closed' | 'special-hours'

export type ClinicMembershipRecordRole =
  | 'clinic_admin'
  | 'clinic_owner'
  | 'doctor'
  | 'receptionist'

export type ClinicMembershipRecordStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'pending_activation'

export type PlanRecordId = 'basic' | 'medium' | 'pro' | string

export type ClinicSubscriptionRecordStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'suspended'
  | 'trial'

export type ReminderRecordChannel = 'whatsapp'

export type ReminderRecordStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'skipped'

export type ReminderRecordType = '24h' | '2h' | 'immediate'

export interface PlanRecord {
  can_manage_team: boolean
  can_use_advanced_reports: boolean
  can_use_whatsapp_automation: boolean
  id: PlanRecordId
  is_active: boolean
  max_users: number
  name: string
}

export interface ClinicSubscriptionRecord {
  clinic_id: string
  created_at: string
  ends_at: string | null
  plan_id: string
  starts_at: string
  status: ClinicSubscriptionRecordStatus
  updated_at: string
}

export interface ClinicMembershipRecord {
  activated_at: string | null
  clinic_id: string
  created_at: string
  id: string
  invited_at: string | null
  role: ClinicMembershipRecordRole
  status: ClinicMembershipRecordStatus
  updated_at: string
  user_id: string
}

export interface Clinic {
  country_code: string
  created_at: string
  id: string
  name: string
  phone: string | null
  updated_at: string
}

export interface UserProfile {
  activated_at?: string | null
  clinic_id: string | null
  created_at: string
  email?: string | null
  full_name: string | null
  id: string
  invited_at?: string | null
  is_platform_admin?: boolean | null
  is_active?: boolean | null
  role: string | null
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

export interface ClinicalRecordRecord {
  clinic_id: string
  created_at: string
  created_by: string | null
  diagnosis: string | null
  id: string
  observations: string | null
  patient_id: string
  reason: string | null
  record_date: string
  treatment: string | null
  updated_at: string
}

export interface OdontogramEntryRecord {
  clinic_id: string
  created_at: string
  created_by: string | null
  id: string
  notes: string | null
  patient_id: string
  status: string
  surface: string | null
  tooth_code: string
  updated_at: string
  updated_by: string | null
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
  clinical_records: ClinicalRecordRecord
  odontogram_entries: OdontogramEntryRecord
  clinic_memberships: ClinicMembershipRecord
  clinic_subscriptions: ClinicSubscriptionRecord
  clinics: Clinic
  patients: PatientRecord
  plans: PlanRecord
  profiles: UserProfile
  reminders: ReminderRecord
  treatments: TreatmentRecord
  whatsapp_settings: WhatsAppSettingsRecord
}

type Insertable<T> =
  Omit<T, 'created_at' | 'id' | 'updated_at'> &
    (T extends { created_at: infer CreatedAt }
      ? { created_at?: CreatedAt }
      : object) &
    (T extends { id: infer Id } ? { id?: Id } : object) &
    (T extends { updated_at: infer UpdatedAt }
      ? { updated_at?: UpdatedAt }
      : object)

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
