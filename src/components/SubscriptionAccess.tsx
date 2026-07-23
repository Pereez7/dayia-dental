import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { MouseEvent } from 'react'

import type {
  Clinic,
  ClinicSubscriptionRecord,
} from '../types/database'
import type { PlatformClinicPlanId } from '../types/platform'
import {
  calculateTieredSubscriptionPayment,
  getSubscriptionAccessState,
  isFounderPricingEligible,
} from '../utils/subscriptionBilling'
import type { BillingCycle } from '../utils/subscriptionBilling'
import { buildBillingWhatsappUrl } from '../utils/billingWhatsapp'
import { formatSubscriptionDate } from '../utils/dateFormatters'
import { submitSubscriptionPaymentNotice } from '../services/subscriptionPaymentSubmissionService'
import { PaymentQr } from './PaymentQr'

const renewalOptions: Array<{
  cycle: RenewalBillingCycle
  discount: number
  label: string
}> = [
  { cycle: 'monthly', discount: 0, label: '1 mes' },
  { cycle: 'six_months', discount: 10, label: '6 meses' },
  { cycle: 'annual', discount: 20, label: '12 meses' },
]

type RenewalBillingCycle = Extract<
  BillingCycle,
  'annual' | 'monthly' | 'six_months'
>

interface SubscriptionMembershipViewProps {
  canSubmitPayment: boolean
  clinic: Clinic
  currency: string
  isBlocked?: boolean
  monthlyPrice: number | null
  onRefreshSubscription?: () => Promise<void>
  planId: string | null
  standardMonthlyPrice?: number | null
  submittedByUserId: string | null
  subscription: ClinicSubscriptionRecord | null
}

export function SubscriptionMembershipView({
  canSubmitPayment,
  clinic,
  currency,
  isBlocked = false,
  monthlyPrice,
  onRefreshSubscription,
  planId,
  standardMonthlyPrice,
  submittedByUserId,
  subscription,
}: SubscriptionMembershipViewProps) {
  const normalizedPlanId = normalizePlan(planId)
  const [selectedCycle, setSelectedCycle] =
    useState<RenewalBillingCycle>('monthly')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false)
  const [noticeFeedback, setNoticeFeedback] = useState('')
  const [noticeFeedbackTone, setNoticeFeedbackTone] =
    useState<'error' | 'success'>('success')
  const refreshedClinicId = useRef<string | null>(null)
  const noticeSubmissionLock = useRef(false)
  const accessState = getSubscriptionAccessState(mapSubscription(subscription))
  const founderPricingEligible = isFounderPricingEligible({
    blockedAt: subscription?.blocked_at,
    paidAt: new Date(),
  })
  const billingPriceTier =
    subscription?.price_tier === 'founder' && !founderPricingEligible
      ? 'standard'
      : subscription?.price_tier ?? 'standard'
  const billingMonthlyPrice =
    subscription?.price_tier === 'founder' && !founderPricingEligible
      ? standardMonthlyPrice ?? monthlyPrice
      : monthlyPrice
  const selectedPayment = useMemo(
    () =>
      calculateTieredSubscriptionPayment({
        billingCycle: selectedCycle,
        effectiveMonthlyPrice: billingMonthlyPrice,
        priceTier: billingPriceTier,
        standardMonthlyPrice: standardMonthlyPrice ?? monthlyPrice,
      }),
    [
      billingMonthlyPrice,
      billingPriceTier,
      monthlyPrice,
      selectedCycle,
      standardMonthlyPrice,
    ],
  )
  const daysRemaining = accessState.daysRemaining
  const selectedCycleLabel =
    renewalOptions.find((option) => option.cycle === selectedCycle)?.label ??
    selectedCycle
  const billingWhatsappUrl = buildBillingWhatsappUrl({
    amount: selectedPayment.amountPaid,
    billingCycleLabel: selectedCycleLabel,
    clinicName: clinic.name,
    currency,
    phone: import.meta.env.VITE_DAYIA_BILLING_WHATSAPP,
    planName: getPlanName(normalizedPlanId),
  })

  const refreshSubscription = useCallback(async () => {
    if (!onRefreshSubscription || isRefreshing) return
    setIsRefreshing(true)
    await onRefreshSubscription()
    setIsRefreshing(false)
  }, [isRefreshing, onRefreshSubscription])

  useEffect(() => {
    if (
      !onRefreshSubscription ||
      refreshedClinicId.current === clinic.id
    ) return

    refreshedClinicId.current = clinic.id
    void refreshSubscription()
  }, [clinic.id, onRefreshSubscription, refreshSubscription])

  function handlePaymentNoticeClick(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (noticeSubmissionLock.current || isSubmittingNotice) {
      event.preventDefault()
      return
    }

    if (!submittedByUserId || selectedPayment.amountPaid <= 0) {
      event.preventDefault()
      setNoticeFeedbackTone('error')
      setNoticeFeedback(
        'No pudimos preparar el aviso de pago. Actualiza la suscripción e inténtalo nuevamente.',
      )
      return
    }

    noticeSubmissionLock.current = true
    setIsSubmittingNotice(true)
    setNoticeFeedback('')

    void submitSubscriptionPaymentNotice({
      amountExpected: selectedPayment.amountPaid,
      billingCycle: selectedCycle,
      clinicId: clinic.id,
      currency,
      planId: normalizedPlanId,
      submittedBy: submittedByUserId,
    })
      .then((result) => {
        if (result.error) {
          setNoticeFeedbackTone('error')
          setNoticeFeedback(result.error)
          return
        }

        setNoticeFeedbackTone('success')
        setNoticeFeedback(
          result.data?.alreadyPending
            ? 'Ya existe un aviso pendiente. Administración DayIA lo revisará.'
            : 'Aviso enviado. Administración DayIA ya puede revisar tu pago.',
        )
      })
      .catch(() => {
        setNoticeFeedbackTone('error')
        setNoticeFeedback(
          'No pudimos avisar a Administración DayIA. Inténtalo nuevamente.',
        )
      })
      .finally(() => {
        noticeSubmissionLock.current = false
        setIsSubmittingNotice(false)
      })
  }

  return (
    <section
      className={`subscription-membership-view${isBlocked ? ' subscription-membership-view--blocked' : ''}`}
      aria-labelledby="subscription-membership-title"
    >
      <header className="subscription-membership-header">
        <div className="subscription-membership-intro">
          <div className="subscription-membership-status-row">
            <span className={`subscription-state subscription-state--${subscription?.status ?? 'unknown'}`}>
              {getMembershipStatusLabel(subscription, isBlocked)}
            </span>
            {onRefreshSubscription ? (
              <button
                className="subscription-refresh-action"
                disabled={isRefreshing}
                onClick={() => void refreshSubscription()}
                type="button"
              >
                {isRefreshing ? 'Actualizando...' : 'Actualizar suscripción'}
              </button>
            ) : null}
          </div>
          <h1 id="subscription-membership-title">Suscripción de {clinic.name}</h1>
          <p>
            {isBlocked
              ? 'Tu sesión y tus datos siguen disponibles. Informa el pago para solicitar la reactivación.'
              : 'Consulta tu vigencia y prepara la próxima renovación por QR.'}
          </p>
        </div>
        <dl className="subscription-membership-facts">
          <div><dt>Plan actual</dt><dd>{getPlanName(normalizedPlanId)}<small>{getPriceTierLabel(subscription?.price_tier, founderPricingEligible)}</small></dd></div>
          <div><dt>Vencimiento</dt><dd>{subscription?.is_lifetime ? 'Sin vencimiento' : formatOptionalDate(subscription?.current_period_ends_at ?? subscription?.trial_ends_at ?? null)}</dd></div>
          <div><dt>Gracia hasta</dt><dd>{subscription?.is_lifetime ? 'No aplica' : formatOptionalDate(subscription?.grace_ends_at ?? null)}</dd></div>
          <div><dt>Días restantes</dt><dd>{subscription?.is_lifetime ? 'Sin límite' : daysRemaining === null ? 'No definido' : `${daysRemaining} días`}</dd></div>
        </dl>
      </header>

      {subscription?.is_lifetime ? (
        <div className="subscription-lifetime-state">
          <strong>Tu licencia no requiere renovación periódica.</strong>
          <span>Administración DayIA conserva el historial y la condición comercial.</span>
        </div>
      ) : (
        <div className="subscription-renewal-layout">
          <div className="subscription-renewal-main">
            <div className="subscription-block-heading">
              <div><h2>Elige un periodo</h2><p>El descuento se aplica sobre el precio mensual de tu tarifa actual.</p></div>
            </div>
            <div className="subscription-renewal-options" role="radiogroup" aria-label="Periodo de renovación">
              {renewalOptions.map((option) => {
                const payment = calculateTieredSubscriptionPayment({
                  billingCycle: option.cycle,
                  effectiveMonthlyPrice: billingMonthlyPrice,
                  priceTier: billingPriceTier,
                  standardMonthlyPrice: standardMonthlyPrice ?? monthlyPrice,
                })
                const isSelected = selectedCycle === option.cycle

                return (
                  <button
                    aria-checked={isSelected}
                    className={`subscription-renewal-option${isSelected ? ' subscription-renewal-option--selected' : ''}`}
                    key={option.cycle}
                    onClick={() => {
                      setSelectedCycle(option.cycle)
                    }}
                    role="radio"
                    type="button"
                  >
                    <span>{option.label}</span>
                    <strong>{payment.amountPaid > 0 ? `${payment.amountPaid.toFixed(2)} ${currency}` : 'Monto por confirmar'}</strong>
                    <small>
                      {getRenewalOptionCaption(
                        option.discount,
                        billingPriceTier,
                      )}
                    </small>
                  </button>
                )
              })}
            </div>

            <div className="subscription-renewal-breakdown">
              <div><span>Precio base</span><strong>{selectedPayment.amountDue.toFixed(2)} {currency}</strong></div>
              <div><span>Descuento</span><strong>{selectedPayment.discountAmount.toFixed(2)} {currency}</strong></div>
              <div><span>Total a pagar</span><strong>{selectedPayment.amountPaid.toFixed(2)} {currency}</strong></div>
            </div>

            {subscription?.price_tier === 'founder' && !founderPricingEligible ? (
              <p className="subscription-inline-warning" role="status">
                La tarifa fundador venció al pasar más de 24 horas desde el bloqueo. Esta renovación usa la tarifa estándar.
              </p>
            ) : null}

            <ol className="subscription-payment-steps">
              <li>Escanea el QR y paga el monto exacto mostrado.</li>
              <li>Guarda la imagen o captura de tu comprobante.</li>
              <li>Envíala por WhatsApp para que Administración DayIA habilite tu pago.</li>
            </ol>

            {canSubmitPayment ? (
              billingWhatsappUrl ? (
                <a
                  aria-disabled={isSubmittingNotice}
                  className="primary-action subscription-whatsapp-action"
                  href={billingWhatsappUrl}
                  onClick={handlePaymentNoticeClick}
                  rel="noreferrer"
                  target="_blank"
                >
                  {isSubmittingNotice
                    ? 'Avisando a Administración...'
                    : 'Enviar comprobante por WhatsApp'}
                </a>
              ) : (
                <p className="subscription-owner-note">
                  Configura el WhatsApp de pagos para habilitar el envío del comprobante.
                </p>
              )
            ) : (
              <p className="subscription-owner-note">Solo el propietario del consultorio puede gestionar la renovación. Contacta al propietario para continuar.</p>
            )}
            {noticeFeedback ? (
              <p
                className={`subscription-payment-feedback subscription-payment-feedback--${noticeFeedbackTone}`}
                role={noticeFeedbackTone === 'error' ? 'alert' : 'status'}
              >
                {noticeFeedback}
              </p>
            ) : null}
          </div>

          <aside className="subscription-payment-aside subscription-member-qr">
            <div><span>Pago por QR</span><h2>Plan {getPlanName(normalizedPlanId)}</h2></div>
            <PaymentQr planId={normalizedPlanId} planName={getPlanName(normalizedPlanId)} />
            <dl>
              <div><dt>Periodo</dt><dd>{renewalOptions.find((option) => option.cycle === selectedCycle)?.label}</dd></div>
              <div><dt>Monto exacto</dt><dd>{selectedPayment.amountPaid.toFixed(2)} {currency}</dd></div>
            </dl>
            <p>El QR corresponde al plan. El periodo cambia únicamente el monto.</p>
          </aside>
        </div>
      )}
    </section>
  )
}

export function SubscriptionBlockedView(
  props: Omit<SubscriptionMembershipViewProps, 'isBlocked'>,
) {
  return <SubscriptionMembershipView {...props} isBlocked />
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

function normalizePlan(planId: string | null): PlatformClinicPlanId {
  if (planId === 'medium' || planId === 'pro') return planId
  return 'basic'
}

function getPlanName(planId: string | null) {
  if (planId === 'medium') return 'Medium'
  if (planId === 'pro') return 'Pro'
  return 'Basic'
}

function formatOptionalDate(value: string | null) {
  return formatSubscriptionDate(value)
}

function getMembershipStatusLabel(
  subscription: ClinicSubscriptionRecord | null,
  isBlocked: boolean,
) {
  if (isBlocked) return 'Acceso suspendido'
  if (subscription?.is_lifetime) return 'Licencia vitalicia'
  if (subscription?.status === 'trialing') return 'Periodo de prueba'
  if (subscription?.status === 'past_due') return 'Periodo de gracia'
  if (subscription?.status === 'active') return 'Suscripción activa'
  return 'Estado por confirmar'
}

function getPriceTierLabel(
  priceTier: ClinicSubscriptionRecord['price_tier'] | undefined,
  founderPricingEligible = true,
) {
  if (priceTier === 'founder') {
    return founderPricingEligible
      ? 'Tarifa fundador'
      : 'Tarifa fundador vencida'
  }
  if (priceTier === 'custom') return 'Tarifa personalizada'
  return 'Tarifa estándar'
}

function getRenewalOptionCaption(
  discount: number,
  priceTier: ClinicSubscriptionRecord['price_tier'] | undefined,
) {
  const tierLabel =
    priceTier === 'founder'
      ? 'Tarifa fundador'
      : priceTier === 'custom'
        ? 'Tarifa personalizada'
        : 'Tarifa estándar'

  return discount > 0 ? `${discount}% de descuento` : tierLabel
}
