import type { ClinicSubscriptionRecord } from '../types/database'
import { getSubscriptionAccessState } from '../utils/subscriptionBilling'
import { getClinicalPermissions } from './permissions'

export function getSubscriptionScopedPermissions({
  isDemoMode,
  isPlatformAdmin,
  planId,
  role,
  subscription,
}: {
  isDemoMode: boolean
  isPlatformAdmin: boolean
  planId: string | null
  role: string | null | undefined
  subscription: ClinicSubscriptionRecord | null
}) {
  const access = getSubscriptionAccessState(
    subscription
      ? {
          currentPeriodEndsAt: subscription.current_period_ends_at,
          graceEndsAt: subscription.grace_ends_at,
          isLifetime: subscription.is_lifetime,
          status: subscription.status,
          trialEndsAt: subscription.trial_ends_at,
        }
      : null,
  )
  const isBlocked =
    !isDemoMode && !isPlatformAdmin && access.access === 'blocked'

  return {
    access,
    isBlocked,
    permissions: getClinicalPermissions(isBlocked ? null : role, planId),
  }
}
