import type { UserProfile, UserRole } from '../types/database'

const legacyRoleMap: Record<string, UserRole> = {
  admin: 'clinic_admin',
  clinic_admin: 'clinic_admin',
  clinic_owner: 'clinic_owner',
  dentist: 'doctor',
  doctor: 'doctor',
  owner: 'clinic_owner',
  platform_admin: 'platform_admin',
  reception: 'receptionist',
  receptionist: 'receptionist',
  super_admin: 'platform_admin',
}

const roleLabels: Record<UserRole, string> = {
  clinic_admin: 'Administrador del consultorio',
  clinic_owner: 'Propietario del consultorio',
  doctor: 'Doctor',
  platform_admin: 'Administrador del consultorio',
  receptionist: 'Recepcionista',
  super_admin: 'Administrador del consultorio',
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (!role) {
    return 'clinic_owner'
  }

  return legacyRoleMap[role] ?? 'clinic_owner'
}

export function getUserRoleLabel(role: string | null | undefined) {
  return roleLabels[normalizeUserRole(role)]
}

export function canManageClinicSettings(role: string | null | undefined) {
  return ['clinic_owner', 'clinic_admin', 'platform_admin'].includes(
    normalizeUserRole(role),
  )
}

export function canManageUsers(role: string | null | undefined) {
  return ['clinic_owner', 'clinic_admin', 'platform_admin'].includes(
    normalizeUserRole(role),
  )
}

export function canManageWhatsapp(role: string | null | undefined) {
  return ['clinic_owner', 'clinic_admin', 'platform_admin'].includes(
    normalizeUserRole(role),
  )
}

export function canManageAppointments(role: string | null | undefined) {
  return [
    'clinic_admin',
    'clinic_owner',
    'doctor',
    'receptionist',
    'platform_admin',
  ].includes(normalizeUserRole(role))
}

export function canManagePatients(role: string | null | undefined) {
  return [
    'clinic_admin',
    'clinic_owner',
    'doctor',
    'receptionist',
    'platform_admin',
  ].includes(normalizeUserRole(role))
}

export function canViewClinicalRecords(role: string | null | undefined) {
  return ['clinic_owner', 'clinic_admin', 'doctor', 'platform_admin'].includes(
    normalizeUserRole(role),
  )
}

export function canAccessPlatformAdministration(
  profile: Pick<UserProfile, 'is_platform_admin' | 'role'> | null | undefined,
) {
  return Boolean(
    profile?.is_platform_admin ||
      normalizeUserRole(profile?.role) === 'platform_admin',
  )
}
