import type { ClinicSubscriptionRecord } from '../types/database'
import { getSubscriptionAccessState } from '../utils/subscriptionBilling'

interface SubscriptionNoticeProps {
  subscription: ClinicSubscriptionRecord | null
}

export function SubscriptionNotice({ subscription }: SubscriptionNoticeProps) {
  const state = getSubscriptionAccessState(
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

  if (!state.notice) return null

  const days = state.daysRemaining ?? 0
  const message =
    state.notice === 'trial_ending'
      ? `Tu prueba gratuita vence en ${days} ${days === 1 ? 'día' : 'días'}. Revisa Suscripción para renovar.`
      : state.notice === 'subscription_ending'
        ? `Tu suscripción vence en ${days} ${days === 1 ? 'día' : 'días'}. Revisa Suscripción para renovar.`
        : `Tu suscripción está vencida. Quedan ${days} ${days === 1 ? 'día' : 'días'} de gracia.`

  return (
    <aside
      className={`subscription-notice subscription-notice--${state.notice}`}
      role="status"
    >
      {message}
    </aside>
  )
}
