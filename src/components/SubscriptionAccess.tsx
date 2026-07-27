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
  calculateUpgradeProration,
  calculateTieredSubscriptionPayment,
  getMonthlyPriceForTier,
  getPlanChangeKind,
  getSubscriptionAccessState,
  isFounderPricingEligible,
} from '../utils/subscriptionBilling'
import type { BillingCycle } from '../utils/subscriptionBilling'
import { buildBillingWhatsappUrl } from '../utils/billingWhatsapp'
import { formatSubscriptionDate } from '../utils/dateFormatters'
import {
  cancelScheduledSubscriptionDowngrade,
  scheduleSubscriptionDowngrade,
  submitSubscriptionPaymentNotice,
} from '../services/subscriptionPaymentSubmissionService'
import {
  listSubscriptionPlans,
  type SubscriptionPlanOption,
} from '../services/subscriptionPlansService'
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
  planOptions?: SubscriptionPlanOption[]
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
  planOptions,
  standardMonthlyPrice,
  submittedByUserId,
  subscription,
}: SubscriptionMembershipViewProps) {
  const normalizedPlanId = normalizePlan(planId)
  const [selectedPlanId, setSelectedPlanId] =
    useState<PlatformClinicPlanId>(normalizedPlanId)
  const [availablePlans, setAvailablePlans] = useState<
    SubscriptionPlanOption[]
  >([])
  const [plansError, setPlansError] = useState('')
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
    graceEndsAt: subscription?.grace_ends_at,
    paidAt: new Date(),
  })
  const displayedPlans =
    planOptions && planOptions.length > 0
      ? planOptions
      : availablePlans.length > 0
      ? availablePlans
      : [
          {
            currency,
            founderMonthlyPrice:
              subscription?.price_tier === 'founder'
                ? monthlyPrice
                : null,
            id: normalizedPlanId,
            monthlyPrice: standardMonthlyPrice ?? monthlyPrice,
            name: getPlanName(normalizedPlanId),
          },
        ]
  const selectedPlan =
    displayedPlans.find((plan) => plan.id === selectedPlanId) ??
    displayedPlans[0]
  const changeKind = getPlanChangeKind(
    normalizedPlanId,
    selectedPlan?.id ?? normalizedPlanId,
  )
  const billingPriceTier =
    subscription?.price_tier === 'founder' && !founderPricingEligible
      ? 'standard'
      : subscription?.price_tier ?? 'standard'
  const billingMonthlyPrice =
    selectedPlan
      ? getMonthlyPriceForTier({
          customPrice: subscription?.custom_monthly_price ?? null,
          founderPrice: selectedPlan.founderMonthlyPrice,
          priceTier: billingPriceTier,
          standardPrice: selectedPlan.monthlyPrice,
        })
      : monthlyPrice
  const selectedStandardMonthlyPrice =
    selectedPlan?.monthlyPrice ?? standardMonthlyPrice ?? monthlyPrice
  const isImmediateUpgrade = changeKind === 'upgrade' && !isBlocked
  const isScheduledDowngrade = changeKind === 'downgrade' && !isBlocked
  const upgradeProration = useMemo(
    () =>
      calculateUpgradeProration({
        currentMonthlyPrice: monthlyPrice,
        currentPeriodEndsAt: subscription?.current_period_ends_at ?? null,
        newMonthlyPrice: billingMonthlyPrice,
      }),
    [
      billingMonthlyPrice,
      monthlyPrice,
      subscription?.current_period_ends_at,
    ],
  )
  const selectedPayment = useMemo(
    () => {
      if (isImmediateUpgrade) {
        return {
          amountDue: upgradeProration.amount,
          amountPaid: upgradeProration.amount,
          customDays: null,
          discountAmount: 0,
          discountPercent: 0,
          monthsCovered: null,
        }
      }

      return calculateTieredSubscriptionPayment({
        billingCycle: selectedCycle,
        effectiveMonthlyPrice: billingMonthlyPrice,
        priceTier: billingPriceTier,
        standardMonthlyPrice: selectedStandardMonthlyPrice,
      })
    },
    [
      billingMonthlyPrice,
      billingPriceTier,
      isImmediateUpgrade,
      selectedCycle,
      selectedStandardMonthlyPrice,
      upgradeProration.amount,
    ],
  )
  const daysRemaining = accessState.daysRemaining
  const selectedCycleLabel =
    isImmediateUpgrade
      ? `Upgrade por ${upgradeProration.daysRemaining} días`
      : renewalOptions.find((option) => option.cycle === selectedCycle)
          ?.label ?? selectedCycle
  const billingWhatsappUrl = buildBillingWhatsappUrl({
    amount: selectedPayment.amountPaid,
    billingCycleLabel: selectedCycleLabel,
    clinicName: clinic.name,
    currency,
    phone: import.meta.env.VITE_DAYIA_BILLING_WHATSAPP,
    planName: getPlanName(selectedPlan?.id ?? normalizedPlanId),
  })

  const refreshSubscription = useCallback(async () => {
    if (!onRefreshSubscription || isRefreshing) return
    setIsRefreshing(true)
    await onRefreshSubscription()
    setIsRefreshing(false)
  }, [isRefreshing, onRefreshSubscription])

  useEffect(() => {
    let isMounted = true

    void listSubscriptionPlans().then((result) => {
      if (!isMounted) return
      setAvailablePlans(result.data)
      setPlansError(result.error ?? '')
    })

    return () => {
      isMounted = false
    }
  }, [])

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

    if (
      !submittedByUserId ||
      !selectedPlan ||
      selectedPayment.amountPaid <= 0
    ) {
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
      billingCycle: selectedCycle,
      clinicId: clinic.id,
      planId: selectedPlan.id,
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

  async function handleScheduleDowngrade() {
    if (
      !selectedPlan ||
      !submittedByUserId ||
      isSubmittingNotice ||
      noticeSubmissionLock.current
    ) {
      return
    }

    noticeSubmissionLock.current = true
    setIsSubmittingNotice(true)
    setNoticeFeedback('')

    try {
      const result = await scheduleSubscriptionDowngrade({
        clinicId: clinic.id,
        planId: selectedPlan.id,
      })
      if (result.error) {
        setNoticeFeedbackTone('error')
        setNoticeFeedback(result.error)
        return
      }

      setNoticeFeedbackTone('success')
      setNoticeFeedback(
        `${getPlanName(selectedPlan.id)} comenzará al finalizar el periodo actual.`,
      )
      await onRefreshSubscription?.()
    } catch {
      setNoticeFeedbackTone('error')
      setNoticeFeedback(
        'No pudimos programar el cambio. Inténtalo nuevamente.',
      )
    } finally {
      noticeSubmissionLock.current = false
      setIsSubmittingNotice(false)
    }
  }

  async function handleCancelScheduledDowngrade() {
    if (
      isSubmittingNotice ||
      noticeSubmissionLock.current
    ) {
      return
    }

    noticeSubmissionLock.current = true
    setIsSubmittingNotice(true)
    setNoticeFeedback('')

    try {
      const result = await cancelScheduledSubscriptionDowngrade(clinic.id)
      if (result.error) {
        setNoticeFeedbackTone('error')
        setNoticeFeedback(result.error)
        return
      }

      setNoticeFeedbackTone('success')
      setNoticeFeedback('El cambio programado fue cancelado.')
      await onRefreshSubscription?.()
    } catch {
      setNoticeFeedbackTone('error')
      setNoticeFeedback(
        'No pudimos cancelar el cambio programado. Inténtalo nuevamente.',
      )
    } finally {
      noticeSubmissionLock.current = false
      setIsSubmittingNotice(false)
    }
  }

  if (subscription?.is_lifetime && !isBlocked) {
    return (
      <section
        className="subscription-membership-view subscription-membership-view--lifetime"
        aria-labelledby="subscription-membership-title"
      >
        <header className="subscription-lifetime-hero">
          <div className="subscription-lifetime-copy">
            <div className="subscription-lifetime-status-row">
              <span className="subscription-lifetime-badge">
                <span aria-hidden="true">✓</span>
                Licencia vitalicia
              </span>
              {onRefreshSubscription ? (
                <button
                  className="subscription-refresh-action subscription-refresh-action--lifetime"
                  disabled={isRefreshing}
                  onClick={() => void refreshSubscription()}
                  type="button"
                >
                  {isRefreshing
                    ? 'Actualizando...'
                    : 'Actualizar suscripción'}
                </button>
              ) : null}
            </div>
            <h1 id="subscription-membership-title">
              Acceso vitalicio de {clinic.name}
            </h1>
            <p>
              Tu consultorio cuenta con acceso permanente a DayIA Dental, sin
              renovaciones periódicas.
            </p>
          </div>

          <div className="subscription-lifetime-mark" aria-hidden="true">
            <span>∞</span>
            <small>DAYIA</small>
          </div>
        </header>

        <div className="subscription-lifetime-details">
          <div className="subscription-lifetime-welcome">
            <span
              className="subscription-lifetime-welcome-icon"
              aria-hidden="true"
            >
              ✓
            </span>
            <div>
              <h2>Tu acceso permanece activo, sin renovaciones.</h2>
              <p>
                Gracias por confiar en DayIA Dental para la gestión diaria de
                tu consultorio.
              </p>
            </div>
          </div>

          <dl className="subscription-lifetime-facts">
            <div>
              <dt>Plan actual</dt>
              <dd>
                {getPlanName(normalizedPlanId)}
                <small>Condición vitalicia</small>
              </dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>
                Permanente
                <small>Sin fecha de vencimiento</small>
              </dd>
            </div>
            <div>
              <dt>Renovación</dt>
              <dd>
                No requerida
                <small>Sin pagos periódicos</small>
              </dd>
            </div>
          </dl>

          <div className="subscription-lifetime-footnote">
            <span aria-hidden="true">◇</span>
            <p>
              <strong>Licencia protegida.</strong> Administración DayIA conserva
              el historial comercial y la trazabilidad de esta condición.
            </p>
          </div>
        </div>
      </section>
    )
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
        <>
          {subscription?.scheduled_plan_id ? (
            <div className="subscription-scheduled-change" role="status">
              <div>
                <strong>
                  Cambio programado a{' '}
                  {getPlanName(subscription.scheduled_plan_id)}
                </strong>
                <span>
                  Comenzará el{' '}
                  {formatOptionalDate(
                    subscription.scheduled_plan_starts_at,
                  )}
                  . Hasta entonces conservarás {getPlanName(normalizedPlanId)}.
                </span>
              </div>
              {canSubmitPayment ? (
                <button
                  className="secondary-action"
                  disabled={isSubmittingNotice}
                  onClick={() => void handleCancelScheduledDowngrade()}
                  type="button"
                >
                  {isSubmittingNotice
                    ? 'Cancelando...'
                    : 'Cancelar cambio programado'}
                </button>
              ) : null}
            </div>
          ) : null}

          {!subscription?.scheduled_plan_id ? (
            <div className="subscription-renewal-layout">
              <div className="subscription-renewal-main">
              <div className="subscription-block-heading">
                <div>
                  <h2>Elige el plan</h2>
                  <p>
                    Verás el importe y la fecha de aplicación antes de
                    continuar.
                  </p>
                </div>
              </div>

              <div
                aria-label="Plan de suscripción"
                className="subscription-plan-options"
                role="radiogroup"
              >
                {displayedPlans.map((plan) => {
                  const planMonthlyPrice = getMonthlyPriceForTier({
                    customPrice:
                      subscription?.custom_monthly_price ?? null,
                    founderPrice: plan.founderMonthlyPrice,
                    priceTier: billingPriceTier,
                    standardPrice: plan.monthlyPrice,
                  })
                  const isSelected = plan.id === selectedPlanId
                  const isCurrent = plan.id === normalizedPlanId

                  return (
                    <button
                      aria-checked={isSelected}
                      className={`subscription-plan-option${isSelected ? ' subscription-plan-option--selected' : ''}`}
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id)
                        setNoticeFeedback('')
                      }}
                      role="radio"
                      type="button"
                    >
                      <span>
                        {plan.name}
                        {isCurrent ? <small>Plan actual</small> : null}
                      </span>
                      <strong>
                        {planMonthlyPrice === null
                          ? 'Precio por confirmar'
                          : `${planMonthlyPrice.toFixed(2)} ${plan.currency} / mes`}
                      </strong>
                    </button>
                  )
                })}
              </div>

              {plansError ? (
                <p className="subscription-inline-warning" role="status">
                  {plansError} Puedes continuar renovando el plan actual.
                </p>
              ) : null}

              {isScheduledDowngrade ? (
                <div className="subscription-plan-change-explanation">
                  <strong>
                    {getPlanName(selectedPlanId)} comenzará al finalizar tu
                    periodo actual.
                  </strong>
                  <p>
                    Conservarás {getPlanName(normalizedPlanId)} hasta el{' '}
                    {formatOptionalDate(
                      subscription?.current_period_ends_at ?? null,
                    )}
                    . No se realizará ningún cobro ahora.
                  </p>
                  {canSubmitPayment ? (
                    <button
                      className="primary-action"
                      disabled={
                        isSubmittingNotice ||
                        Boolean(subscription?.scheduled_plan_id)
                      }
                      onClick={() => void handleScheduleDowngrade()}
                      type="button"
                    >
                      {isSubmittingNotice
                        ? 'Programando cambio...'
                        : `Programar cambio a ${getPlanName(selectedPlanId)}`}
                    </button>
                  ) : (
                    <p className="subscription-owner-note">
                      Solo el propietario puede programar el cambio de plan.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {isImmediateUpgrade ? (
                    <div className="subscription-plan-change-explanation">
                      <strong>
                        El upgrade se activa después de validar el pago.
                      </strong>
                      <p>
                        Pagarás la diferencia por{' '}
                        {upgradeProration.daysRemaining} días y conservarás el
                        vencimiento del{' '}
                        {formatOptionalDate(
                          subscription?.current_period_ends_at ?? null,
                        )}
                        .
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="subscription-block-heading subscription-period-heading">
                        <div>
                          <h2>Elige un periodo</h2>
                          <p>
                            El descuento se aplica al precio mensual del plan
                            seleccionado.
                          </p>
                        </div>
                      </div>
                      <div
                        aria-label="Periodo de renovación"
                        className="subscription-renewal-options"
                        role="radiogroup"
                      >
                        {renewalOptions.map((option) => {
                          const payment =
                            calculateTieredSubscriptionPayment({
                              billingCycle: option.cycle,
                              effectiveMonthlyPrice: billingMonthlyPrice,
                              priceTier: billingPriceTier,
                              standardMonthlyPrice:
                                selectedStandardMonthlyPrice,
                            })
                          const isSelected =
                            selectedCycle === option.cycle

                          return (
                            <button
                              aria-checked={isSelected}
                              className={`subscription-renewal-option${isSelected ? ' subscription-renewal-option--selected' : ''}`}
                              key={option.cycle}
                              onClick={() =>
                                setSelectedCycle(option.cycle)
                              }
                              role="radio"
                              type="button"
                            >
                              <span>{option.label}</span>
                              <strong>
                                {payment.amountPaid > 0
                                  ? `${payment.amountPaid.toFixed(2)} ${selectedPlan?.currency ?? currency}`
                                  : 'Monto por confirmar'}
                              </strong>
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
                    </>
                  )}

                  <div className="subscription-renewal-breakdown">
                    <div>
                      <span>
                        {isImmediateUpgrade
                          ? 'Diferencia prorrateada'
                          : 'Precio base'}
                      </span>
                      <strong>
                        {selectedPayment.amountDue.toFixed(2)}{' '}
                        {selectedPlan?.currency ?? currency}
                      </strong>
                    </div>
                    <div>
                      <span>Descuento</span>
                      <strong>
                        {selectedPayment.discountAmount.toFixed(2)}{' '}
                        {selectedPlan?.currency ?? currency}
                      </strong>
                    </div>
                    <div>
                      <span>Total a pagar</span>
                      <strong>
                        {selectedPayment.amountPaid.toFixed(2)}{' '}
                        {selectedPlan?.currency ?? currency}
                      </strong>
                    </div>
                  </div>

                  {subscription?.price_tier === 'founder' &&
                  !founderPricingEligible ? (
                    <p
                      className="subscription-inline-warning"
                      role="status"
                    >
                      La tarifa fundador venció al pasar más de 24 horas desde
                      el bloqueo. Esta operación usa la tarifa estándar.
                    </p>
                  ) : null}

                  <ol className="subscription-payment-steps">
                    <li>Escanea el QR y paga el monto exacto mostrado.</li>
                    <li>Guarda la imagen o captura de tu comprobante.</li>
                    <li>
                      Envíala por WhatsApp para que Administración DayIA valide
                      el pago.
                    </li>
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
                        Configura el WhatsApp de pagos para habilitar el envío
                        del comprobante.
                      </p>
                    )
                  ) : (
                    <p className="subscription-owner-note">
                      Solo el propietario puede gestionar la renovación.
                      Contacta al propietario para continuar.
                    </p>
                  )}
                </>
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

              <aside
                className={`subscription-payment-aside${isScheduledDowngrade ? ' subscription-plan-change-aside' : ' subscription-member-qr'}`}
              >
              {isScheduledDowngrade ? (
                <>
                  <div>
                    <span>Cambio al renovar</span>
                    <h2>Plan {getPlanName(selectedPlanId)}</h2>
                  </div>
                  <dl>
                    <div>
                      <dt>Aplicación</dt>
                      <dd>
                        {formatOptionalDate(
                          subscription?.current_period_ends_at ?? null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Cobro ahora</dt>
                      <dd>0.00 {selectedPlan?.currency ?? currency}</dd>
                    </div>
                  </dl>
                  <p>
                    El plan actual conserva sus funciones hasta el vencimiento.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <span>Pago por QR</span>
                    <h2>
                      Plan{' '}
                      {getPlanName(selectedPlan?.id ?? normalizedPlanId)}
                    </h2>
                  </div>
                  <PaymentQr
                    planId={selectedPlan?.id ?? normalizedPlanId}
                    planName={getPlanName(
                      selectedPlan?.id ?? normalizedPlanId,
                    )}
                  />
                  <dl>
                    <div>
                      <dt>Concepto</dt>
                      <dd>{selectedCycleLabel}</dd>
                    </div>
                    <div>
                      <dt>Monto exacto</dt>
                      <dd>
                        {selectedPayment.amountPaid.toFixed(2)}{' '}
                        {selectedPlan?.currency ?? currency}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    El QR corresponde al plan seleccionado. Verifica el monto
                    antes de pagar.
                  </p>
                </>
              )}
              </aside>
            </div>
          ) : null}
        </>
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
