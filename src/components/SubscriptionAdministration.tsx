import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import {
  registerSubscriptionPayment,
  updateClinicSubscription,
  voidSubscriptionPayment,
} from '../services/platformAdminService'
import type {
  PlatformClinicPlanId,
  PlatformClinicSummary,
  PlatformSubscriptionPayment,
  RegisterSubscriptionPaymentInput,
  UpdateClinicSubscriptionInput,
} from '../types/platform'
import {
  calculateTieredSubscriptionPayment,
  calculateUpgradeProration,
  getMonthlyPriceForTier,
  getPlanChangeKind,
  isFounderPricingEligible,
  shouldBlockImplicitPaymentSubmit,
  suggestedDiscounts,
  validateSubscriptionPayment,
  type BillingCycle,
} from '../utils/subscriptionBilling'
import { formatAppDate, formatSubscriptionDate } from '../utils/dateFormatters'
import { ConfirmDialog } from './ConfirmDialog'
import { PaymentQr } from './PaymentQr'

interface SubscriptionAdministrationProps {
  clinic: PlatformClinicSummary
  onClose: () => void
  onUpdated: () => Promise<void> | void
}

const cycleLabels: Record<BillingCycle, string> = {
  annual: '12 meses',
  custom_days: 'Días personalizados',
  lifetime: 'Vitalicio',
  monthly: '1 mes',
  six_months: '6 meses',
}

export function SubscriptionAdministration({
  clinic,
  onClose,
  onUpdated,
}: SubscriptionAdministrationProps) {
  const currentPlanId = normalizePlan(clinic.planId)
  const [planId, setPlanId] = useState<PlatformClinicPlanId>(currentPlanId)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [customDays, setCustomDays] = useState(30)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [manualAmount, setManualAmount] = useState(0)
  const [amountOverride, setAmountOverride] = useState('')
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState(
    clinic.customMonthlyPrice ?? 0,
  )
  const [forcePlanChange, setForcePlanChange] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paidAt, setPaidAt] = useState(() => toLocalDateTimeInput(new Date()))
  const [extraDays, setExtraDays] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('success')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [pendingPayment, setPendingPayment] =
    useState<RegisterSubscriptionPaymentInput | null>(null)
  const [selectedPayment, setSelectedPayment] =
    useState<PlatformSubscriptionPayment | null>(null)
  const [paymentToVoid, setPaymentToVoid] =
    useState<PlatformSubscriptionPayment | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const submissionLock = useRef(false)

  const configuredMonthlyPrice = getMonthlyPriceForTier({
    customPrice: clinic.customMonthlyPrice,
    founderPrice: clinic.planFounderMonthlyPrices[currentPlanId] ?? null,
    priceTier: clinic.priceTier,
    standardPrice: clinic.planMonthlyPrices[currentPlanId] ?? null,
  })
  const standardMonthlyPrice =
    clinic.planMonthlyPrices[currentPlanId] ?? null
  const founderPricingEligible = isFounderPricingEligible({
    blockedAt: clinic.blockedAt,
    paidAt,
  })
  const effectivePriceTier =
    clinic.priceTier === 'founder' && !founderPricingEligible
      ? 'standard'
      : clinic.priceTier
  const monthlyPrice =
    effectivePriceTier === 'standard'
      ? standardMonthlyPrice
      : configuredMonthlyPrice
  const calculation = useMemo(
    () =>
      calculateTieredSubscriptionPayment({
        billingCycle,
        customDays,
        discountPercent,
        effectiveMonthlyPrice: monthlyPrice,
        manualAmount,
        priceTier: effectivePriceTier,
        standardMonthlyPrice,
      }),
    [
      billingCycle,
      effectivePriceTier,
      customDays,
      discountPercent,
      manualAmount,
      monthlyPrice,
      standardMonthlyPrice,
    ],
  )
  const finalAmount =
    amountOverride === '' ? calculation.amountPaid : Number(amountOverride)
  const hasManualAmountDifference =
    amountOverride !== '' &&
    Number.isFinite(finalAmount) &&
    Math.abs(finalAmount - calculation.amountPaid) >= 0.01
  const changeKind = getPlanChangeKind(currentPlanId, planId)
  const targetMonthlyPrice = getMonthlyPriceForTier({
    customPrice: clinic.customMonthlyPrice,
    founderPrice: clinic.planFounderMonthlyPrices[planId] ?? null,
    priceTier: clinic.priceTier,
    standardPrice: clinic.planMonthlyPrices[planId] ?? null,
  })
  const upgradeProration = calculateUpgradeProration({
    currentMonthlyPrice: monthlyPrice,
    currentPeriodEndsAt: clinic.currentPeriodEndsAt,
    newMonthlyPrice: targetMonthlyPrice,
  })
  const latestRegisteredPaymentId = clinic.payments.find(
    (payment) => payment.status === 'registered',
  )?.id
  const pendingSubmissions = clinic.paymentSubmissions.filter(
    (submission) => submission.status === 'pending_review',
  )
  const selectedSubmission = clinic.paymentSubmissions.find(
    (submission) => submission.id === selectedSubmissionId,
  )

  function handleCycleChange(cycle: BillingCycle) {
    setBillingCycle(cycle)
    setDiscountPercent(suggestedDiscounts[cycle])
    setAmountOverride('')
    clearFieldError('billingCycle')
  }

  function handlePaymentKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      shouldBlockImplicitPaymentSubmit(event.key) &&
      event.target instanceof HTMLElement &&
      event.target.tagName !== 'TEXTAREA'
    ) {
      event.preventDefault()
    }
  }

  function handlePaymentReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    const errors = validateSubscriptionPayment({
      billingCycle,
      customDays,
      discountPercent,
      finalAmount,
      paidAt,
      reference,
    })

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      showFeedback('Revisa los campos señalados antes de continuar.', 'error')
      return
    }

    setFeedback('')
    setPendingPayment({
      amountPaid: finalAmount,
      billingCycle,
      clinicId: clinic.clinicId,
      customDays: calculation.customDays,
      discountPercent: calculation.discountPercent,
      isLifetime: billingCycle === 'lifetime',
      notes,
      paidAt: new Date(paidAt).toISOString(),
      planId: currentPlanId,
      reference: reference.trim(),
      submissionId: selectedSubmissionId ?? undefined,
    })
  }

  async function confirmPaymentRegistration() {
    if (!pendingPayment || isSubmitting || submissionLock.current) return

    submissionLock.current = true
    setIsSubmitting(true)
    setFeedback('')

    try {
      const result = await registerSubscriptionPayment(pendingPayment)

      if (!result.success) {
        showFeedback(result.error ?? 'No pudimos registrar el pago.', 'error')
        return
      }

      setPendingPayment(null)
      setReference('')
      setNotes('')
      setAmountOverride('')
      setSelectedSubmissionId(null)
      showFeedback('Pago registrado y suscripción actualizada.', 'success')
      await onUpdated()
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }
  }

  function reviewUpgradePayment() {
    if (!reference.trim()) {
      setFieldErrors({ reference: 'Ingresa la referencia del comprobante.' })
      showFeedback('La referencia es obligatoria para registrar el upgrade.', 'error')
      return
    }

    if (upgradeProration.amount <= 0) {
      showFeedback(
        'No hay días o diferencia de precio para calcular el upgrade.',
        'error',
      )
      return
    }

    setPendingPayment({
      amountPaid: upgradeProration.amount,
      billingCycle: 'monthly',
      clinicId: clinic.clinicId,
      customDays: null,
      discountPercent: 0,
      isLifetime: false,
      notes,
      paidAt: new Date().toISOString(),
      paymentType: 'upgrade_proration',
      planId,
      reference: reference.trim(),
    })
  }

  async function handlePlanChange() {
    if (changeKind === 'same') {
      showFeedback('Selecciona un plan diferente.', 'error')
      return
    }
    if (forcePlanChange) {
      await runAction({
        action: 'force_change_plan',
        clinicId: clinic.clinicId,
        notes,
        planId,
      })
      return
    }
    if (changeKind === 'downgrade') {
      await runAction({
        action: 'change_plan',
        clinicId: clinic.clinicId,
        notes,
        planId,
      })
      return
    }

    reviewUpgradePayment()
  }

  async function runAction(input: UpdateClinicSubscriptionInput) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback('')

    try {
      const result = await updateClinicSubscription(input)
      showFeedback(
        result.error ?? 'Suscripción actualizada correctamente.',
        result.success ? 'success' : 'error',
      )
      if (result.success) await onUpdated()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmVoidPayment() {
    if (!paymentToVoid || isSubmitting || submissionLock.current) return

    if (voidReason.trim().length < 5) {
      showFeedback(
        'Explica el motivo de la anulación con al menos 5 caracteres.',
        'error',
      )
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)

    try {
      const result = await voidSubscriptionPayment({
        paymentId: paymentToVoid.id,
        reason: voidReason.trim(),
      })

      if (!result.success) {
        showFeedback(result.error ?? 'No pudimos anular el pago.', 'error')
        return
      }

      setPaymentToVoid(null)
      setSelectedPayment(null)
      setVoidReason('')
      showFeedback('Pago anulado y vigencia recalculada.', 'success')
      await onUpdated()
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }
  }

  function populatePaymentSubmission(
    submission: PlatformClinicSummary['paymentSubmissions'][number],
  ) {
    setBillingCycle(submission.billingCycle)
    setDiscountPercent(suggestedDiscounts[submission.billingCycle])
    setAmountOverride('')
    setReference(submission.reference)
    setNotes(submission.notes ?? '')
    setPaidAt(toLocalDateTimeInput(new Date(submission.createdAt)))
    setSelectedSubmissionId(submission.id)
    setFieldErrors({})
    showFeedback('Solicitud cargada en la calculadora para su revisión.', 'success')
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  function showFeedback(message: string, tone: 'error' | 'success') {
    setFeedback(message)
    setFeedbackTone(tone)
  }

  return (
    <section
      className="subscription-admin"
      aria-labelledby="subscription-admin-title"
    >
      <header className="subscription-admin-header">
        <div>
          <h2 id="subscription-admin-title">
            Suscripción de {clinic.clinicName}
          </h2>
          <p>Revisa vigencia, comprobante e importe antes de registrar.</p>
        </div>
        <button className="secondary-action" onClick={onClose} type="button">
          Cerrar gestión
        </button>
      </header>

      <section
        className="subscription-summary-block"
        aria-labelledby="subscription-summary-title"
      >
        <div className="subscription-block-heading">
          <div>
            <h3 id="subscription-summary-title">Resumen de suscripción</h3>
            <p>Estado comercial y fechas que controlan el acceso.</p>
          </div>
          <span className={`subscription-state subscription-state--${clinic.subscriptionStatus ?? 'unknown'}`}>
            {getSubscriptionStatusLabel(clinic)}
          </span>
        </div>
        <dl className="subscription-facts">
          <SummaryFact label="Plan actual" value={clinic.planName ?? 'Sin plan'} />
          <SummaryFact label="Tarifa" value={priceTierLabel(clinic.priceTier)} />
          <SummaryFact
            label="Precio mensual"
            value={formatMoney(monthlyPrice, clinic.currency)}
          />
          <SummaryFact label="Prueba hasta" value={formatOptionalDate(clinic.trialEndsAt)} />
          <SummaryFact
            label="Pagado hasta"
            value={clinic.isLifetime ? 'Sin vencimiento' : formatOptionalDate(clinic.currentPeriodEndsAt)}
          />
          <SummaryFact
            label="Gracia hasta"
            value={clinic.isLifetime ? 'No aplica' : formatOptionalDate(clinic.graceEndsAt)}
          />
          <SummaryFact label="Último pago" value={formatOptionalDate(clinic.lastPaymentAt)} />
          <SummaryFact
            label="Días restantes"
            value={getDaysRemainingLabel(clinic.currentPeriodEndsAt, clinic.isLifetime)}
          />
          <SummaryFact
            label="Próximo plan"
            value={
              clinic.scheduledPlanId
                ? `${getPlanName(clinic.scheduledPlanId)} · ${formatOptionalDate(clinic.scheduledPlanStartsAt)}`
                : 'Sin cambio programado'
            }
          />
        </dl>
      </section>

      {pendingSubmissions.length > 0 ? (
        <section className="subscription-submissions" aria-labelledby="payment-submissions-title">
          <div className="subscription-block-heading">
            <div>
              <h3 id="payment-submissions-title">Avisos pendientes</h3>
              <p>El propietario informó estos pagos. Verifica el comprobante antes de aprobar.</p>
            </div>
            <span className="subscription-count">{pendingSubmissions.length}</span>
          </div>
          <div className="subscription-submission-list">
            {pendingSubmissions.map((submission) => (
              <article key={submission.id}>
                <div>
                  <strong>{submission.submittedBy ?? 'Propietario del consultorio'}</strong>
                  <span>{formatDateTime(submission.createdAt)} · {cycleLabels[submission.billingCycle]}</span>
                </div>
                <div>
                  <strong>{submission.amountExpected.toFixed(2)} {submission.currency}</strong>
                  <span>Ref. {submission.reference}</span>
                </div>
                <button className="secondary-action" onClick={() => populatePaymentSubmission(submission)} type="button">
                  Revisar solicitud
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section
        className="subscription-calculator-block"
        aria-labelledby="payment-calculator-title"
      >
        <div className="subscription-block-heading">
          <div>
            <h3 id="payment-calculator-title">Calculadora de pago</h3>
            <p>Enter no registra el pago. La acción final requiere revisión y confirmación.</p>
          </div>
        </div>

        <div className="subscription-admin-grid">
          <form
            className="subscription-payment-form"
            noValidate
            onKeyDown={handlePaymentKeyDown}
            onSubmit={handlePaymentReview}
          >
            <div className="subscription-form-grid">
              <label>
                Plan actual
                <input readOnly value={getPlanName(currentPlanId)} />
              </label>
              <label>
                Tipo de precio
                <input readOnly value={priceTierLabel(effectivePriceTier)} />
              </label>
              <label>
                Periodo
                <select
                  value={billingCycle}
                  onChange={(event) =>
                    handleCycleChange(event.target.value as BillingCycle)
                  }
                >
                  {Object.entries(cycleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {billingCycle === 'custom_days' ? (
                <FieldWithError error={fieldErrors.customDays}>
                  <label>
                    Días de acceso
                    <input
                      min="1"
                      onChange={(event) => {
                        setCustomDays(Number(event.target.value))
                        clearFieldError('customDays')
                      }}
                      type="number"
                      value={customDays}
                    />
                  </label>
                </FieldWithError>
              ) : null}
              {monthlyPrice === null || billingCycle === 'lifetime' ? (
                <label>
                  Monto base manual
                  <input
                    min="0.01"
                    onChange={(event) => setManualAmount(Number(event.target.value))}
                    step="0.01"
                    type="number"
                    value={manualAmount || ''}
                  />
                </label>
              ) : (
                <label>
                  Precio mensual
                  <input readOnly value={formatMoney(monthlyPrice, clinic.currency)} />
                </label>
              )}
              <FieldWithError error={fieldErrors.discountPercent}>
                <label>
                  Descuento (%)
                  <input
                    max="100"
                    min="0"
                    onChange={(event) => {
                      setDiscountPercent(Number(event.target.value))
                      setAmountOverride('')
                      clearFieldError('discountPercent')
                    }}
                    step="0.01"
                    type="number"
                    value={discountPercent}
                  />
                </label>
              </FieldWithError>
              <FieldWithError error={fieldErrors.finalAmount}>
                <label>
                  Monto final ({clinic.currency})
                  <input
                    min="0.01"
                    onChange={(event) => {
                      setAmountOverride(event.target.value)
                      clearFieldError('finalAmount')
                    }}
                    step="0.01"
                    type="number"
                    value={amountOverride === '' ? calculation.amountPaid : amountOverride}
                  />
                </label>
              </FieldWithError>
              <FieldWithError error={fieldErrors.paidAt}>
                <label>
                  Fecha y hora de pago
                  <input
                    onChange={(event) => {
                      setPaidAt(event.target.value)
                      clearFieldError('paidAt')
                    }}
                    step="60"
                    type="datetime-local"
                    value={paidAt}
                  />
                </label>
              </FieldWithError>
              <FieldWithError error={fieldErrors.reference}>
                <label>
                  Referencia
                  <input
                    maxLength={200}
                    onChange={(event) => {
                      setReference(event.target.value)
                      clearFieldError('reference')
                    }}
                    placeholder="Número o nombre del comprobante"
                    value={reference}
                  />
                </label>
              </FieldWithError>
              <label className="subscription-field-wide">
                Notas
                <textarea
                  maxLength={1000}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  value={notes}
                />
              </label>
            </div>

            {selectedSubmission ? (
              <p className="subscription-inline-note" role="status">
                Monto informado por el cliente: {selectedSubmission.amountExpected.toFixed(2)} {selectedSubmission.currency}. El monto final se recalcula con la tarifa vigente en la fecha y hora del pago.
              </p>
            ) : null}

            {clinic.priceTier === 'founder' && !founderPricingEligible ? (
              <p className="subscription-inline-warning" role="status">
                La tarifa fundador venció porque el pago se registró más de 24 horas después del bloqueo. Se aplicará la tarifa estándar.
              </p>
            ) : null}

            {hasManualAmountDifference ? (
              <p className="subscription-inline-warning" role="status">
                El monto editado difiere del cálculo de {calculation.amountPaid.toFixed(2)} {clinic.currency}. Revisa la diferencia antes de continuar.
              </p>
            ) : null}

            <div className="subscription-calculation-summary" aria-live="polite">
              <div><span>Precio base</span><strong>{calculation.amountDue.toFixed(2)} {clinic.currency}</strong></div>
              <div><span>Descuento</span><strong>{calculation.discountAmount.toFixed(2)} {clinic.currency}</strong></div>
              <div><span>Total</span><strong>{Number.isFinite(finalAmount) ? finalAmount.toFixed(2) : '0.00'} {clinic.currency}</strong></div>
            </div>

            <div className="subscription-register-action">
              <div>
                <strong>Acción final</strong>
                <span>Revisa el resumen antes de crear el registro.</span>
              </div>
              <button className="primary-action" disabled={isSubmitting} type="submit">
                Revisar registro
              </button>
            </div>
          </form>

          <aside className="subscription-payment-aside">
            <div>
              <span>QR de cobro</span>
              <h4>Plan {getPlanName(currentPlanId)}</h4>
            </div>
            <PaymentQr planId={currentPlanId} planName={getPlanName(currentPlanId)} />
            <dl>
              <div><dt>Periodo</dt><dd>{cycleLabels[billingCycle]}</dd></div>
              <div><dt>Monto exacto</dt><dd>{Number.isFinite(finalAmount) ? finalAmount.toFixed(2) : '0.00'} {clinic.currency}</dd></div>
            </dl>
            <p>El periodo modifica el monto, no la imagen del QR.</p>
          </aside>
        </div>
      </section>

      {feedback ? (
        <p className={`subscription-feedback subscription-feedback--${feedbackTone}`} role={feedbackTone === 'error' ? 'alert' : 'status'}>
          {feedback}
        </p>
      ) : null}

      <AdministrativeActions
        changeKind={changeKind}
        clinic={clinic}
        customMonthlyPrice={customMonthlyPrice}
        extraDays={extraDays}
        forcePlanChange={forcePlanChange}
        isSubmitting={isSubmitting}
        notes={notes}
        planId={planId}
        upgradeProration={upgradeProration}
        onBlock={() => setIsBlockDialogOpen(true)}
        onCustomMonthlyPriceChange={setCustomMonthlyPrice}
        onExtraDaysChange={setExtraDays}
        onForcePlanChange={setForcePlanChange}
        onPlanChange={setPlanId}
        onRunAction={runAction}
        onSubmitPlanChange={() => void handlePlanChange()}
      />

      <section className="subscription-payment-history" aria-labelledby="payment-history-title">
        <div className="subscription-block-heading">
          <div>
            <h3 id="payment-history-title">Historial de pagos</h3>
            <p>Los pagos anulados permanecen visibles para conservar trazabilidad.</p>
          </div>
        </div>
        {clinic.payments.length === 0 ? (
          <div className="subscription-history-empty">
            <strong>Aún no hay pagos registrados</strong>
            <span>El primer registro aparecerá aquí después de confirmarlo.</span>
          </div>
        ) : (
          <div className="platform-clinics-table-wrap">
            <table className="platform-clinics-table subscription-history-table">
              <thead><tr><th>Fecha</th><th>Plan y periodo</th><th>Monto</th><th>Referencia</th><th>Estado</th><th>Registrado por</th><th>Acciones</th></tr></thead>
              <tbody>
                {clinic.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Fecha">{formatDateTime(payment.paidAt)}</td>
                    <td data-label="Plan y periodo"><strong>{getPlanName(payment.planId)}</strong><span>{payment.paymentType === 'upgrade_proration' ? 'Upgrade prorrateado' : cycleLabels[payment.billingCycle as BillingCycle] ?? payment.billingCycle}</span></td>
                    <td data-label="Monto"><strong>{payment.amountPaid.toFixed(2)} {payment.currency}</strong></td>
                    <td data-label="Referencia">{payment.reference ?? 'Sin referencia'}</td>
                    <td data-label="Estado"><span className={`payment-ledger-status payment-ledger-status--${payment.status}`}>{payment.status === 'voided' ? 'Anulado' : 'Registrado'}</span></td>
                    <td data-label="Registrado por">{payment.recordedBy ?? 'Administrador DayIA'}</td>
                    <td data-label="Acciones">
                      <div className="subscription-history-actions">
                        <button className="secondary-action" onClick={() => setSelectedPayment(payment)} type="button">Ver detalle</button>
                        <button
                          className="danger-action"
                          disabled={payment.status === 'voided' || payment.id !== latestRegisteredPaymentId || isSubmitting}
                          title={payment.id !== latestRegisteredPaymentId ? 'Solo puede anularse el último pago vigente.' : undefined}
                          onClick={() => setPaymentToVoid(payment)}
                          type="button"
                        >
                          Anular pago
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PaymentConfirmationDialog
        clinic={clinic}
        priceTier={effectivePriceTier}
        isSubmitting={isSubmitting}
        payment={pendingPayment}
        calculation={
          pendingPayment?.paymentType === 'upgrade_proration'
            ? {
                amountDue: upgradeProration.amount,
                discountAmount: 0,
              }
            : calculation
        }
        onCancel={() => !isSubmitting && setPendingPayment(null)}
        onConfirm={() => void confirmPaymentRegistration()}
      />

      <PaymentDetailDialog
        canVoid={
          selectedPayment?.status === 'registered' &&
          selectedPayment.id === latestRegisteredPaymentId
        }
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onVoid={(payment) => {
          setSelectedPayment(null)
          setPaymentToVoid(payment)
        }}
      />

      <ConfirmDialog
        cancelLabel="Conservar pago"
        confirmLabel={isSubmitting ? 'Anulando...' : 'Confirmar anulación'}
        isCancelDisabled={isSubmitting}
        isConfirmDisabled={isSubmitting || voidReason.trim().length < 5}
        isOpen={Boolean(paymentToVoid)}
        message="El pago seguirá en el historial y la suscripción volverá al estado anterior al registro."
        onCancel={() => {
          if (isSubmitting) return
          setPaymentToVoid(null)
          setVoidReason('')
        }}
        onConfirm={() => void confirmVoidPayment()}
        title="Anular pago registrado"
        variant="danger"
      >
        <label className="confirm-dialog-field">
          Motivo de anulación
          <textarea
            autoFocus
            maxLength={500}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="Explica por qué debe anularse este pago"
            rows={4}
            value={voidReason}
          />
          <span>Mínimo 5 caracteres. El motivo quedará en auditoría.</span>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        cancelLabel="Conservar acceso"
        confirmLabel="Bloquear consultorio"
        isConfirmDisabled={isSubmitting}
        isOpen={isBlockDialogOpen}
        message="El equipo conservará su sesión, pero dejará de acceder a los módulos clínicos. Los datos no se eliminarán."
        onCancel={() => setIsBlockDialogOpen(false)}
        onConfirm={() => {
          setIsBlockDialogOpen(false)
          void runAction({ action: 'block', clinicId: clinic.clinicId })
        }}
        title="¿Bloquear acceso clínico?"
        variant="warning"
      />
    </section>
  )
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function FieldWithError({
  children,
  error,
}: {
  children: React.ReactNode
  error?: string
}) {
  return <div className="subscription-field-wrapper">{children}{error ? <span className="field-message field-message--error">{error}</span> : null}</div>
}

function PaymentConfirmationDialog({
  calculation,
  clinic,
  isSubmitting,
  onCancel,
  onConfirm,
  payment,
  priceTier,
}: {
  calculation: { amountDue: number; discountAmount: number }
  clinic: PlatformClinicSummary
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
  payment: RegisterSubscriptionPaymentInput | null
  priceTier: PlatformClinicSummary['priceTier']
}) {
  if (!payment) return null

  return (
    <ConfirmDialog
      cancelLabel="Volver a editar"
      confirmLabel={isSubmitting ? 'Registrando...' : 'Confirmar registro'}
      isCancelDisabled={isSubmitting}
      isConfirmDisabled={isSubmitting}
      isOpen
      message="Comprueba que estos datos coincidan con el comprobante recibido."
      onCancel={onCancel}
      onConfirm={onConfirm}
      size="wide"
      title="Revisar registro de pago"
      variant="info"
    >
      <dl className="payment-review-summary">
        <SummaryFact label="Clínica" value={clinic.clinicName} />
        <SummaryFact label="Plan" value={getPlanName(payment.planId)} />
        <SummaryFact label="Tipo de precio" value={priceTierLabel(priceTier)} />
        <SummaryFact label="Periodo" value={payment.paymentType === 'upgrade_proration' ? 'Upgrade prorrateado' : cycleLabels[payment.billingCycle]} />
        <SummaryFact label="Precio base" value={`${calculation.amountDue.toFixed(2)} ${clinic.currency}`} />
        <SummaryFact label="Descuento" value={`${payment.discountPercent}% · ${calculation.discountAmount.toFixed(2)} ${clinic.currency}`} />
        <SummaryFact label="Monto final" value={`${payment.amountPaid.toFixed(2)} ${clinic.currency}`} />
        <SummaryFact label="Fecha y hora de pago" value={formatDateTime(payment.paidAt)} />
        <SummaryFact label="Referencia" value={payment.reference} />
        <SummaryFact label="Notas" value={payment.notes.trim() || 'Sin notas'} />
      </dl>
    </ConfirmDialog>
  )
}

function PaymentDetailDialog({
  canVoid,
  onClose,
  onVoid,
  payment,
}: {
  canVoid: boolean
  onClose: () => void
  onVoid: (payment: PlatformSubscriptionPayment) => void
  payment: PlatformSubscriptionPayment | null
}) {
  if (!payment) return null

  return (
    <ConfirmDialog
      cancelLabel="Cerrar detalle"
      confirmLabel={payment.status === 'voided' ? 'Pago anulado' : 'Anular pago'}
      isConfirmDisabled={!canVoid}
      isOpen
      message="Consulta los datos conservados en el historial administrativo."
      onCancel={onClose}
      onConfirm={() => onVoid(payment)}
      size="wide"
      title="Detalle del pago"
      variant={payment.status === 'voided' ? 'info' : 'warning'}
    >
      <dl className="payment-review-summary">
        <SummaryFact label="Estado" value={payment.status === 'voided' ? 'Anulado' : 'Registrado'} />
        <SummaryFact label="Plan" value={getPlanName(payment.planId)} />
        <SummaryFact label="Periodo" value={cycleLabels[payment.billingCycle as BillingCycle] ?? payment.billingCycle} />
        <SummaryFact label="Monto base" value={`${payment.amountDue.toFixed(2)} ${payment.currency}`} />
        <SummaryFact label="Descuento" value={`${payment.discountPercent}% · ${payment.discountAmount.toFixed(2)} ${payment.currency}`} />
        <SummaryFact label="Monto pagado" value={`${payment.amountPaid.toFixed(2)} ${payment.currency}`} />
        <SummaryFact label="Referencia" value={payment.reference ?? 'Sin referencia'} />
        <SummaryFact label="Registrado por" value={payment.recordedBy ?? 'Administrador DayIA'} />
        <SummaryFact label="Vigencia desde" value={formatDateTime(payment.periodStartsAt)} />
        <SummaryFact label="Vigencia hasta" value={payment.periodEndsAt ? formatDateTime(payment.periodEndsAt) : 'Sin vencimiento'} />
        <SummaryFact label="Notas" value={payment.notes ?? 'Sin notas'} />
        {payment.status === 'voided' ? <SummaryFact label="Anulación" value={`${formatDateTime(payment.voidedAt)} · ${payment.voidedBy ?? 'Administrador DayIA'} · ${payment.voidReason ?? 'Sin motivo'}`} /> : null}
      </dl>
    </ConfirmDialog>
  )
}

function AdministrativeActions({
  changeKind,
  clinic,
  customMonthlyPrice,
  extraDays,
  forcePlanChange,
  isSubmitting,
  notes,
  onBlock,
  onCustomMonthlyPriceChange,
  onExtraDaysChange,
  onForcePlanChange,
  onPlanChange,
  onRunAction,
  onSubmitPlanChange,
  planId,
  upgradeProration,
}: {
  changeKind: 'downgrade' | 'same' | 'upgrade'
  clinic: PlatformClinicSummary
  customMonthlyPrice: number
  extraDays: number
  forcePlanChange: boolean
  isSubmitting: boolean
  notes: string
  onBlock: () => void
  onCustomMonthlyPriceChange: (value: number) => void
  onExtraDaysChange: (value: number) => void
  onForcePlanChange: (value: boolean) => void
  onPlanChange: (value: PlatformClinicPlanId) => void
  onRunAction: (input: UpdateClinicSubscriptionInput) => Promise<void>
  onSubmitPlanChange: () => void
  planId: PlatformClinicPlanId
  upgradeProration: { amount: number; daysRemaining: number }
}) {
  const currentPlanId = normalizePlan(clinic.planId)
  const founderPrice = clinic.planFounderMonthlyPrices[currentPlanId] ?? null
  const hasFounderPrice = founderPrice !== null && founderPrice > 0

  return (
    <section className="subscription-management-block" aria-labelledby="subscription-management-title">
      <div className="subscription-block-heading"><div><h3 id="subscription-management-title">Ajustes administrativos</h3><p>Cambios de plan, tarifa y acceso separados del registro de cobro.</p></div></div>
      <div className="subscription-management-groups">
        <div className="subscription-actions">
          <div className="section-heading"><h4>Cambio de plan</h4><p className="section-description">Los upgrades conservan el vencimiento. Los downgrades comienzan al terminar el periodo.</p></div>
          <div className="subscription-action-row">
            <label>Nuevo plan<select value={planId} onChange={(event) => onPlanChange(event.target.value as PlatformClinicPlanId)}><option value="basic">Basic</option><option value="medium">Medium</option><option value="pro">Pro</option></select></label>
            <p>{changeKind === 'upgrade' ? `Prorrateo: ${upgradeProration.amount.toFixed(2)} ${clinic.currency} por ${upgradeProration.daysRemaining} días` : changeKind === 'downgrade' ? `Comienza el ${formatOptionalDate(clinic.currentPeriodEndsAt)}` : 'Selecciona un plan distinto.'}</p>
            <label className="subscription-checkbox"><input checked={forcePlanChange} onChange={(event) => onForcePlanChange(event.target.checked)} type="checkbox" /> Forzar cambio inmediato</label>
            <button className="secondary-action" disabled={isSubmitting || changeKind === 'same'} onClick={onSubmitPlanChange} type="button">{forcePlanChange ? 'Aplicar excepción' : changeKind === 'upgrade' ? 'Revisar upgrade' : 'Programar downgrade'}</button>
          </div>
        </div>
        <div className="subscription-actions">
          <div className="section-heading"><h4>Condición comercial</h4><p className="section-description">La tarifa determina el cálculo, no la imagen del QR.</p></div>
          <div className="subscription-action-row">
            <div className="subscription-founder-setting">
              <span>Tarifa fundador</span>
              <strong>{hasFounderPrice ? `${founderPrice.toFixed(2)} ${clinic.currency} / mes` : 'No configurada para el plan'}</strong>
            </div>
            <button className="secondary-action" disabled={isSubmitting || !hasFounderPrice || clinic.priceTier === 'founder'} onClick={() => void onRunAction({ action: 'set_founder_price', clinicId: clinic.clinicId, notes })} type="button">{clinic.priceTier === 'founder' ? 'Tarifa fundador activa' : 'Asignar tarifa fundador'}</button>
            <label>Precio personalizado<input min="0" onChange={(event) => onCustomMonthlyPriceChange(Number(event.target.value))} step="0.01" type="number" value={customMonthlyPrice} /></label>
            <button className="secondary-action" disabled={isSubmitting} onClick={() => void onRunAction({ action: 'set_custom_price', clinicId: clinic.clinicId, customMonthlyPrice, notes })} type="button">Aplicar personalizado</button>
            <button className="secondary-action" disabled={isSubmitting} onClick={() => void onRunAction({ action: 'set_standard_price', clinicId: clinic.clinicId, notes })} type="button">Usar tarifa estándar</button>
          </div>
        </div>
        <div className="subscription-actions">
          <div className="section-heading"><h4>Acceso</h4><p className="section-description">Las acciones sensibles conservan auditoría y no eliminan datos.</p></div>
          <div className="subscription-action-row">
            <label>Días adicionales<input min="1" onChange={(event) => onExtraDaysChange(Number(event.target.value))} type="number" value={extraDays} /></label>
            <button className="secondary-action" disabled={isSubmitting} onClick={() => void onRunAction({ action: 'grant_extra_days', clinicId: clinic.clinicId, days: extraDays, notes })} type="button">Aumentar días</button>
            <button className="secondary-action" disabled={isSubmitting} onClick={() => void onRunAction({ action: 'reactivate', clinicId: clinic.clinicId })} type="button">Reactivar acceso</button>
            <button className="danger-action" disabled={isSubmitting} onClick={onBlock} type="button">Bloquear consultorio</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function normalizePlan(planId: string | null): PlatformClinicPlanId {
  return planId === 'medium' || planId === 'pro' ? planId : 'basic'
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatOptionalDate(value: string | null) {
  return formatSubscriptionDate(value)
}

function formatDateTime(value: string | null) {
  return value ? formatAppDate(value) : 'No definido'
}

function priceTierLabel(tier: PlatformClinicSummary['priceTier']) {
  if (tier === 'founder') return 'Fundador'
  if (tier === 'custom') return 'Personalizada'
  return 'Estándar'
}

function getPlanName(planId: string | null) {
  if (planId === 'medium') return 'Medium'
  if (planId === 'pro') return 'Pro'
  return 'Basic'
}

function formatMoney(value: number | null, currency: string) {
  return value === null ? 'No configurado' : `${value.toFixed(2)} ${currency}`
}

function getSubscriptionStatusLabel(clinic: PlatformClinicSummary) {
  if (clinic.isLifetime) return 'Vitalicio'
  const labels: Record<string, string> = {
    active: 'Activa',
    blocked: 'Bloqueada',
    canceled: 'Cancelada',
    past_due: 'En gracia',
    trialing: 'En prueba',
  }
  return labels[clinic.subscriptionStatus ?? ''] ?? 'Estado no definido'
}

function getDaysRemainingLabel(periodEndsAt: string | null, isLifetime: boolean) {
  if (isLifetime) return 'Sin límite'
  if (!periodEndsAt) return 'No definido'
  const difference = new Date(periodEndsAt).getTime() - Date.now()
  if (!Number.isFinite(difference)) return 'No definido'
  return `${Math.max(0, Math.ceil(difference / 86_400_000))} días`
}
