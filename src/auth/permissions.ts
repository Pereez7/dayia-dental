import type {
  KnownUserRole,
  LegacyUserRole,
  UserProfile,
  UserRole,
} from '../types/database'

const knownUserRoles = new Set<KnownUserRole>([
  'clinic_admin',
  'clinic_owner',
  'doctor',
  'platform_admin',
  'receptionist',
])

const legacyClinicRoleMap: Record<
  Exclude<LegacyUserRole, 'super_admin'>,
  KnownUserRole
> = {
  admin: 'clinic_admin',
  owner: 'clinic_owner',
}

const roleLabels: Record<UserRole, string> = {
  clinic_admin: 'Administrador del consultorio',
  clinic_owner: 'Propietario del consultorio',
  doctor: 'Doctor',
  platform_admin: 'Administrador del consultorio',
  receptionist: 'Recepcionista',
  unknown: 'Rol no válido',
}

interface NormalizeUserRoleOptions {
  allowLegacyPlatformAdmin?: boolean
}

export function isKnownUserRole(
  role: string | null | undefined,
): role is KnownUserRole {
  return Boolean(role && knownUserRoles.has(role as KnownUserRole))
}

export function normalizeUserRole(
  role: string | null | undefined,
  options: NormalizeUserRoleOptions = {},
): UserRole {
  const normalizedRole = role?.trim()

  if (isKnownUserRole(normalizedRole)) {
    return normalizedRole
  }

  if (normalizedRole === 'owner' || normalizedRole === 'admin') {
    return legacyClinicRoleMap[normalizedRole]
  }

  if (
    normalizedRole === 'super_admin' &&
    options.allowLegacyPlatformAdmin === true
  ) {
    return 'platform_admin'
  }

  return 'unknown'
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
