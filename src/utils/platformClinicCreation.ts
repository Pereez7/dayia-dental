import type { CreatePlatformClinicServiceResult } from '../services/platformAdminService'
import type { CreatePlatformClinicInput } from '../types/platform'

interface SubmissionLock {
  current: boolean
}

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

export async function submitPlatformClinicOnce(
  input: CreatePlatformClinicInput,
  submissionLock: SubmissionLock,
  createClinic: (
    input: CreatePlatformClinicInput,
  ) => Promise<CreatePlatformClinicServiceResult>,
) {
  if (submissionLock.current) {
    return null
  }

  submissionLock.current = true

  try {
    return await createClinic(input)
  } finally {
    submissionLock.current = false
  }
}
