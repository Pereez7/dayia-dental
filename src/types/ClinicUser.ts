import type { ClinicMembershipRecordStatus, UserRole } from './database'

export type ClinicUserRole = 'clinic_admin' | 'doctor' | 'receptionist'

export interface ClinicUser {
  activatedAt: string | null
  clinicId: string | null
  createdAt: string | null
  email: string | null
  fullName: string
  id: string
  invitedAt: string | null
  role: UserRole
  status: ClinicMembershipRecordStatus
}

export interface ClinicMembersPlanSummary {
  id: string
  maxUsers: number
}

export interface ClinicMembersList {
  memberCount: number
  members: ClinicUser[]
  plan: ClinicMembersPlanSummary
}

export type ClinicMemberActivationStatus =
  | 'already_active'
  | 'not_sent'
  | 'pending'

export interface ClinicUserFormValues {
  email: string
  fullName: string
  role: ClinicUserRole
}

export interface ClinicUserFormErrors {
  email?: string
  fullName?: string
  role?: string
}
