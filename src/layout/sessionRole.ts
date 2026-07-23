import { normalizeUserRole } from '../auth/permissions'
import type { UserRole } from '../types/database'

const compactRoleLabels: Record<UserRole, string> = {
  clinic_admin: 'Administrador',
  clinic_owner: 'Propietario',
  doctor: 'Doctor',
  platform_admin: 'Administrador DayIA',
  receptionist: 'Recepción',
  unknown: 'Rol no válido',
}

const sessionPlanLabels = {
  basic: 'Plan Basic',
  medium: 'Plan Medium',
  pro: 'Plan Pro',
} as const

export function getSessionRoleLabel({
  isDemoMode,
  isPlatformAdministration,
  role,
}: {
  isDemoMode: boolean
  isPlatformAdministration: boolean
  role: string | null | undefined
}) {
  if (isPlatformAdministration) {
    return compactRoleLabels.platform_admin
  }

  if (isDemoMode) {
    return 'Modo demo'
  }

  return compactRoleLabels[normalizeUserRole(role)]
}

export function getSessionPlanLabel({
  planId,
  role,
}: {
  planId: string | null | undefined
  role: string | null | undefined
}) {
  if (normalizeUserRole(role) !== 'clinic_owner') {
    return null
  }

  if (planId === 'basic' || planId === 'medium' || planId === 'pro') {
    return sessionPlanLabels[planId]
  }

  return null
}
