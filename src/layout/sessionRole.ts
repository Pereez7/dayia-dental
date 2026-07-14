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
