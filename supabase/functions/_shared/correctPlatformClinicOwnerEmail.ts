export class CorrectPlatformClinicOwnerEmailError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'CorrectPlatformClinicOwnerEmailError'
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeCorrectPlatformClinicOwnerEmailPayload(
  value: unknown,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidPayload()
  }

  const candidate = value as Record<string, unknown>
  const clinicId =
    typeof candidate.clinicId === 'string' ? candidate.clinicId.trim() : ''
  const ownerEmail =
    typeof candidate.ownerEmail === 'string'
      ? candidate.ownerEmail.trim().toLowerCase()
      : ''

  if (!uuidPattern.test(clinicId) || !emailPattern.test(ownerEmail)) {
    throw invalidPayload()
  }

  return { clinicId, ownerEmail }
}

export function isRegisteredAuthEmailError(
  error: { message?: string; status?: number } | null | undefined,
) {
  return Boolean(
    error &&
      (error.status === 422 ||
        error.message?.toLowerCase().includes('already')),
  )
}

function invalidPayload() {
  return new CorrectPlatformClinicOwnerEmailError(
    'INVALID_PAYLOAD',
    'Ingresa un email válido para el propietario.',
    400,
  )
}
