export type ResolvedClinicStatus =
  | 'active'
  | 'pending_activation'
  | 'suspended'
  | 'unknown'

export type ResolvedSubscriptionStatus =
  | 'active'
  | 'blocked'
  | 'canceled'
  | 'lifetime'
  | 'past_due'
  | 'trialing'
  | 'unknown'

export interface OwnerMembershipCandidate {
  activated_at: string | null
  clinic_id: string
  created_at: string
  user_id: string
}

export interface OwnerProfileCandidate {
  email: string | null
  full_name: string | null
  id: string
}

export interface PrimaryOwner {
  email: string | null
  fullName: string | null
  userId: string
}

const clinicStatuses = new Set<ResolvedClinicStatus>([
  'active',
  'pending_activation',
  'suspended',
])

export function resolveClinicStatus(
  clinicStatus: string | null | undefined,
  subscriptionStatus: string | null | undefined,
): ResolvedClinicStatus {
  const normalizedStatus = clinicStatus?.trim().toLowerCase()

  if (clinicStatuses.has(normalizedStatus as ResolvedClinicStatus)) {
    return normalizedStatus as ResolvedClinicStatus
  }

  if (!normalizedStatus) {
    return subscriptionStatus?.trim().toLowerCase() === 'active'
      ? 'active'
      : 'pending_activation'
  }

  return 'unknown'
}

export function normalizeSubscriptionStatus(
  status: string | null | undefined,
): ResolvedSubscriptionStatus | null {
  const normalizedStatus = status?.trim().toLowerCase()

  if (!normalizedStatus) {
    return null
  }

  if (normalizedStatus === 'trial' || normalizedStatus === 'trialing') {
    return 'trialing'
  }

  if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
    return 'canceled'
  }

  if (
    normalizedStatus === 'active' ||
    normalizedStatus === 'past_due' ||
    normalizedStatus === 'blocked' ||
    normalizedStatus === 'lifetime'
  ) {
    return normalizedStatus
  }

  return 'unknown'
}

export function selectPrimaryOwner(
  memberships: OwnerMembershipCandidate[],
  profilesById: Map<string, OwnerProfileCandidate>,
): PrimaryOwner | null {
  const candidates = memberships
    .map((membership) => ({
      membership,
      profile: profilesById.get(membership.user_id),
    }))
    .filter(
      (candidate): candidate is {
        membership: OwnerMembershipCandidate
        profile: OwnerProfileCandidate
      } => Boolean(candidate.profile),
    )
    .sort((left, right) => {
      const emailPriority =
        getEmailPriority(left.profile.email) -
        getEmailPriority(right.profile.email)

      if (emailPriority !== 0) {
        return emailPriority
      }

      const activationOrder =
        getTimestamp(right.membership.activated_at) -
        getTimestamp(left.membership.activated_at)

      if (activationOrder !== 0) {
        return activationOrder
      }

      const creationOrder =
        getTimestamp(right.membership.created_at) -
        getTimestamp(left.membership.created_at)

      if (creationOrder !== 0) {
        return creationOrder
      }

      return left.membership.user_id.localeCompare(right.membership.user_id)
    })

  const primary = candidates[0]

  if (!primary) {
    return null
  }

  return {
    email: primary.profile.email?.trim() || null,
    fullName: primary.profile.full_name?.trim() || null,
    userId: primary.membership.user_id,
  }
}

function getEmailPriority(email: string | null) {
  return email && !isTemporaryEmail(email) ? 0 : 1
}

function isTemporaryEmail(email: string) {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''

  return (
    domain === 'test.com' ||
    domain === 'example.com' ||
    domain === 'example.org' ||
    domain === 'localhost' ||
    domain.endsWith('.test')
  )
}

function getTimestamp(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}
