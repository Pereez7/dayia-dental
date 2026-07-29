export type ClinicMemberLifecycleAction = 'deactivate' | 'reactivate'

export interface ManageClinicMemberPayload {
  action: ClinicMemberLifecycleAction
  membershipId: string
  reason: string
}

export class ManageClinicMemberError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ManageClinicMemberError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeManageClinicMemberPayload(
  value: unknown,
): ManageClinicMemberPayload {
  if (!value || typeof value !== 'object') {
    throw invalidPayload()
  }

  const candidate = value as Record<string, unknown>
  const action = candidate.action
  const membershipId =
    typeof candidate.membershipId === 'string'
      ? candidate.membershipId.trim()
      : ''
  const reason =
    typeof candidate.reason === 'string'
      ? candidate.reason.trim().replace(/\s+/g, ' ')
      : ''

  if (
    (action !== 'deactivate' && action !== 'reactivate') ||
    !uuidPattern.test(membershipId)
  ) {
    throw invalidPayload()
  }

  if (reason.length < 5 || reason.length > 500) {
    throw new ManageClinicMemberError(
      'INVALID_REASON',
      'Explica el motivo con al menos 5 caracteres.',
      400,
    )
  }

  return { action, membershipId, reason }
}

export function getTargetMembershipStatus(
  action: ClinicMemberLifecycleAction,
) {
  return action === 'deactivate' ? 'inactive' : 'active'
}

function invalidPayload() {
  return new ManageClinicMemberError(
    'INVALID_PAYLOAD',
    'No pudimos identificar la acción o el usuario.',
    400,
  )
}
