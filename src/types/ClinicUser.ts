import type { UserRole } from './database'

export type ClinicUserRole = 'clinic_admin' | 'doctor' | 'receptionist'

export interface ClinicUser {
  activatedAt: string | null
  clinicId: string | null
  createdAt: string | null
  email: string | null
  fullName: string
  id: string
  invitedAt: string | null
  isActive: boolean
  role: UserRole
}

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
