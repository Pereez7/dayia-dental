import type { Clinic, ClinicSubscriptionRecord } from '../types/database'
import {
  calculateSubscriptionPayment,
  getSubscriptionAccessState,
} from '../utils/subscriptionBilling'
import type { PriceTier } from '../utils/subscriptionBilling'
import { PaymentQr } from './PaymentQr'

interface SubscriptionNoticeProps {
  subscription: ClinicSubscriptionRecord | null
}

export function SubscriptionNotice({ subscription }: SubscriptionNoticeProps) {
  const state = getSubscriptionAccessState(mapSubscription(subscription))

  if (!state.notice) return null

  const days = state.daysRemaining ?? 0
  const message =
    state.notice === 'trial_ending'
      ? `Tu prueba gratuita vence en ${days} ${days === 1 ? 'día' : 'días'}.`
      : state.notice === 'subscription_ending'
        ? `Tu suscripción vence en ${days} ${days === 1 ? 'día' : 'días'}.`
        : `Tu suscripción está vencida. Quedan ${days} ${days === 1 ? 'día' : 'días'} de gracia.`

  return (
    <aside className={`subscription-notice subscription-notice--${state.notice}`} role="status">
      {message}
    </aside>
  )
}

interface SubscriptionBlockedViewProps {
  clinic: Clinic
  currency: string
  monthlyPrice: number | null
  planId: string | null
  priceTier?: PriceTier
}

export function SubscriptionBlockedView({
  clinic,
  currency,
  monthlyPrice,
  planId,
  priceTier = 'standard',
}: SubscriptionBlockedViewProps) {
  const planName = getPlanName(planId)
  const periods = [
    { cycle: 'monthly' as const, label: '1 mes' },
    { cycle: 'six_months' as const, label: '6 meses', note: '10% de descuento' },
    { cycle: 'annual' as const, label: '12 meses', note: '20% de descuento' },
  ]

  return (
    <section className="subscription-blocked-view" aria-labelledby="subscription-blocked-title">
      <div className="subscription-blocked-copy">
        <span className="platform-status platform-status--suspended">Acceso suspendido</span>
        <h1 id="subscription-blocked-title">Reactiva {clinic.name}</h1>
        <p>
          Tu sesión continúa abierta y tus datos permanecen guardados. Registra
          el pago para recuperar el acceso a los módulos del consultorio.
        </p>
        <dl>
          <div><dt>Plan actual</dt><dd>{planName}</dd></div>
          <div><dt>Precio mensual</dt><dd>{monthlyPrice === null ? 'Confirma el monto con DayIA' : `${monthlyPrice.toFixed(2)} ${currency}`}</dd></div>
          <div><dt>Tarifa</dt><dd>{priceTier === 'founder' ? 'Fundador · se mantiene durante la gracia' : priceTier === 'custom' ? 'Personalizada' : 'Estándar'}</dd></div>
        </dl>
        {priceTier === 'founder' ? (
          <p>Precio fundador activo mientras mantengas tu suscripción al día.</p>
        ) : null}
      </div>

      <div className="subscription-blocked-payment">
        <PaymentQr planId={planId} planName={planName} />
        <div className="subscription-period-options">
          {periods.map(({ cycle, label, note }) => {
            const payment = calculateSubscriptionPayment({
              billingCycle: cycle,
              monthlyPrice,
            })
            return (
              <div key={cycle}>
                <strong>{label}</strong>
                <span>{payment.amountPaid ? `${payment.amountPaid.toFixed(2)} ${currency}` : note ?? 'Monto por confirmar'}{payment.amountPaid && note ? ` · ${note}` : ''}</span>
              </div>
            )
          })}
        </div>
        <p>Realiza el pago y envía el comprobante para reactivar tu consultorio.</p>
        <div className="subscription-proof-contact">
          <strong>Enviar comprobante por WhatsApp</strong>
          <span>Solicita a DayIA el número habilitado para validar pagos.</span>
        </div>
      </div>
    </section>
  )
}

function mapSubscription(subscription: ClinicSubscriptionRecord | null) {
  if (!subscription) return null

  return {
    currentPeriodEndsAt: subscription.current_period_ends_at,
    graceEndsAt: subscription.grace_ends_at,
    isLifetime: subscription.is_lifetime,
    status: subscription.status,
    trialEndsAt: subscription.trial_ends_at,
  }
}

function getPlanName(planId: string | null) {
  if (planId === 'medium') return 'Medium'
  if (planId === 'pro') return 'Pro'
  return 'Basic'
}
