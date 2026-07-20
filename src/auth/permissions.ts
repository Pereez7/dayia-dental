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
  platform_admin: 'Administrador DayIA',
  receptionist: 'Recepcionista',
  unknown: 'Rol no válido',
}

interface NormalizeUserRoleOptions {
  allowLegacyPlatformAdmin?: boolean
}

export interface ClinicalPermissions {
  canAccessAppointments: boolean
  canAccessClinicalHistory: boolean
  canAccessDashboard: boolean
  canAccessOdontogram: boolean
  canAccessPatients: boolean
  canAccessReminders: boolean
  canAccessSettings: boolean
  canManageClinicUsers: boolean
  canManageWhatsapp: boolean
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

export function getClinicalPermissions(
  role: string | null | undefined,
  planId: string | null | undefined,
): ClinicalPermissions {
  const normalizedRole = normalizeUserRole(role)
  const isClinicManager =
    normalizedRole === 'clinic_owner' || normalizedRole === 'clinic_admin'
  const isClinicalProfessional = normalizedRole === 'doctor'
  const isReceptionist = normalizedRole === 'receptionist'
  const hasClinicalAccess =
    isClinicManager || isClinicalProfessional || isReceptionist
  const normalizedPlan = normalizePlanId(planId)

  return {
    canAccessAppointments: hasClinicalAccess,
    canAccessClinicalHistory: isClinicManager || isClinicalProfessional,
    canAccessDashboard: hasClinicalAccess,
    canAccessOdontogram: isClinicManager || isClinicalProfessional,
    canAccessPatients: hasClinicalAccess,
    canAccessReminders: isClinicManager || isReceptionist,
    canAccessSettings: isClinicManager,
    canManageClinicUsers:
      isClinicManager &&
      (normalizedPlan === 'medium' || normalizedPlan === 'pro'),
    canManageWhatsapp: isClinicManager && normalizedPlan === 'pro',
  }
}

export function canAccessDashboard(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessDashboard
}

export function canAccessPatients(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessPatients
}

export function canAccessAppointments(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessAppointments
}

export function canAccessClinicalHistory(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessClinicalHistory
}

export function canAccessOdontogram(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessOdontogram
}

export function canAccessReminders(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessReminders
}

export function canAccessSettings(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canAccessSettings
}

export function canManageClinicUsers(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canManageClinicUsers
}

export function canManageWhatsapp(
  role: string | null | undefined,
  planId: string | null | undefined,
) {
  return getClinicalPermissions(role, planId).canManageWhatsapp
}

export const canManageClinicSettings = canAccessSettings
export const canManageUsers = canManageClinicUsers
export const canManageAppointments = canAccessAppointments
export const canManagePatients = canAccessPatients
export const canViewClinicalRecords = canAccessClinicalHistory

export function canAccessPlatformAdmin(
  profile: Pick<UserProfile, 'is_platform_admin' | 'role'> | null | undefined,
) {
  return Boolean(
    profile?.is_platform_admin ||
      normalizeUserRole(profile?.role) === 'platform_admin',
  )
}

export const canAccessPlatformAdministration = canAccessPlatformAdmin

function normalizePlanId(planId: string | null | undefined) {
  if (planId === 'basic' || planId === 'medium' || planId === 'pro') {
    return planId
  }

  return 'unknown'
}
