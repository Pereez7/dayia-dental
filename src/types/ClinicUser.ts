import type { UserRole } from './database'

export type ClinicUserRole = Exclude<UserRole, 'super_admin'>

export interface ClinicUser {
  clinicId: string | null
  createdAt: string | null
  email: string | null
  fullName: string
  id: string
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
