import type { ClinicalPermissions } from './permissions'

export interface SensitiveDataAccess {
  canLoadClinicUsers: boolean
  canLoadClinicalRecords: boolean
  canLoadOdontogram: boolean
  canLoadWhatsappSettings: boolean
}

export function getSensitiveDataAccess(
  permissions: ClinicalPermissions,
): SensitiveDataAccess {
  return {
    canLoadClinicUsers: permissions.canManageClinicUsers,
    canLoadClinicalRecords: permissions.canAccessClinicalHistory,
    canLoadOdontogram: permissions.canAccessOdontogram,
    canLoadWhatsappSettings: permissions.canManageWhatsapp,
  }
}

export async function runSensitiveLoader<Result>(
  canLoad: boolean,
  loader: () => Promise<Result>,
) {
  if (!canLoad) {
    return { called: false as const, result: null }
  }

  return { called: true as const, result: await loader() }
}
