export class ResendPlatformClinicInvitationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ResendPlatformClinicInvitationError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const invitationResendCooldownMs = 60_000

export function normalizeResendInvitationPayload(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw invalidPayload()
  }

  const clinicId =
    typeof (value as { clinicId?: unknown }).clinicId === 'string'
      ? (value as { clinicId: string }).clinicId.trim()
      : ''

  if (!uuidPattern.test(clinicId)) {
    throw invalidPayload()
  }

  return { clinicId }
}

export function getInvitationResendWaitSeconds(
  lastSentAt: string | null | undefined,
  now = Date.now(),
) {
  if (!lastSentAt) return 0

  const lastSentTimestamp = Date.parse(lastSentAt)
  if (Number.isNaN(lastSentTimestamp)) return 0

  return Math.max(
    0,
    Math.ceil(
      (lastSentTimestamp + invitationResendCooldownMs - now) / 1_000,
    ),
  )
}

function invalidPayload() {
  return new ResendPlatformClinicInvitationError(
    'INVALID_PAYLOAD',
    'No pudimos identificar el consultorio.',
    400,
  )
}
