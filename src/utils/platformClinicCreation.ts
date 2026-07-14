import type { CreatePlatformClinicServiceResult } from '../services/platformAdminService'
import type { CreatePlatformClinicInput } from '../types/platform'

export async function createPlatformClinicAndRefresh(
  input: CreatePlatformClinicInput,
  createClinic: (
    input: CreatePlatformClinicInput,
  ) => Promise<CreatePlatformClinicServiceResult>,
  refreshClinics: () => Promise<unknown>,
) {
  const result = await createClinic(input)

  if (result.data && !result.error) {
    await refreshClinics()
  }

  return result
}
