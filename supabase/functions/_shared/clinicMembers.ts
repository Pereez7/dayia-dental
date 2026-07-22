export type InvitableClinicRole =
  | 'clinic_admin'
  | 'doctor'
  | 'receptionist'

export type ManagedPlanId = 'medium' | 'pro'

export const clinicMemberAvailableSubscriptionStatuses = [
  'trial',
  'trialing',
  'active',
] as const

export interface InviteClinicMemberPayload {
  email: string
  fullName: string
  role: InvitableClinicRole
}

export interface MembershipLimitInput {
  currentCount: number
  maxUsers: number
  planId: string
}

export class ClinicMemberError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ClinicMemberError'
    this.code = code
    this.status = status
  }
}

const allowedRoles = new Set<InvitableClinicRole>([
  'clinic_admin',
  'doctor',
  'receptionist',
])

const managedPlanLimits: Record<ManagedPlanId, number> = {
  medium: 4,
  pro: 10,
}

export function normalizeInviteClinicMemberPayload(
  value: unknown,
): InviteClinicMemberPayload {
  if (!value || typeof value !== 'object') {
    throw invalidPayload()
  }

  const candidate = value as Record<string, unknown>
  const fullName = normalizePersonName(candidate.fullName)
  const email = normalizeEmail(candidate.email)
  const role = candidate.role

  if (fullName.length < 3 || !isEmail(email)) {
    throw invalidPayload()
  }

  if (typeof role !== 'string' || !allowedRoles.has(role as InvitableClinicRole)) {
    throw new ClinicMemberError(
      'INVALID_ROLE',
      'Selecciona un rol válido para el consultorio.',
      400,
    )
  }

  return { email, fullName, role: role as InvitableClinicRole }
}

export function getManagedPlanLimit(
  planId: string | null | undefined,
  databaseLimit?: number | null,
) {
  const normalizedPlan = planId?.trim().toLowerCase()

  if (normalizedPlan !== 'medium' && normalizedPlan !== 'pro') {
    throw new ClinicMemberError(
      'PLAN_NOT_ELIGIBLE',
      'Tu plan actual no permite gestionar usuarios del consultorio.',
      403,
    )
  }

  const configuredLimit = managedPlanLimits[normalizedPlan]
  return Math.min(
    configuredLimit,
    Number.isInteger(databaseLimit) && Number(databaseLimit) > 0
      ? Number(databaseLimit)
      : configuredLimit,
  )
}

export function assertMembershipLimit({
  currentCount,
  maxUsers,
  planId,
}: MembershipLimitInput) {
  const safeLimit = getManagedPlanLimit(planId, maxUsers)

  if (currentCount >= safeLimit) {
    throw new ClinicMemberError(
      'MEMBER_LIMIT_REACHED',
      'Tu plan alcanzó el límite de usuarios.',
      409,
    )
  }
}

export function assertNoClinicMembership(hasMembership: boolean) {
  if (hasMembership) {
    throw new ClinicMemberError(
      'MEMBERSHIP_ALREADY_EXISTS',
      'Este usuario ya pertenece al consultorio.',
      409,
    )
  }
}

export function isCountedMembershipStatus(status: string) {
  return status === 'active' || status === 'pending' || status === 'pending_activation'
}

export function normalizePersonName(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  const lowercaseParticles = new Set([
    'da',
    'das',
    'de',
    'del',
    'do',
    'dos',
    'la',
    'las',
    'los',
    'y',
  ])

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-BO')
    .split(' ')
    .map((word, index) => {
      if (index > 0 && lowercaseParticles.has(word)) {
        return word
      }

      return word
        .split(/([-'])/)
        .map((part) =>
          part === '-' || part === "'"
            ? part
            : `${part.charAt(0).toLocaleUpperCase('es-BO')}${part.slice(1)}`,
        )
        .join('')
    })
    .join(' ')
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function invalidPayload() {
  return new ClinicMemberError(
    'INVALID_PAYLOAD',
    'Revisa el nombre, email y rol antes de continuar.',
    400,
  )
}
