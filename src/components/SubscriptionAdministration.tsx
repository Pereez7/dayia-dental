import { useMemo, useState, type FormEvent } from 'react'

import {
  registerSubscriptionPayment,
  updateClinicSubscription,
} from '../services/platformAdminService'
import type {
  PlatformClinicPlanId,
  PlatformClinicSummary,
  UpdateClinicSubscriptionInput,
} from '../types/platform'
import {
  calculateSubscriptionPayment,
  calculateUpgradeProration,
  getMonthlyPriceForTier,
  getPlanChangeKind,
  suggestedDiscounts,
  type BillingCycle,
} from '../utils/subscriptionBilling'
import { formatAppDate } from '../utils/dateFormatters'
import { PaymentQr } from './PaymentQr'
import { ConfirmDialog } from './ConfirmDialog'

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
  const [planId, setPlanId] = useState<PlatformClinicPlanId>(
    normalizePlan(clinic.planId),
  )
  const currentPlanId = normalizePlan(clinic.planId)
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
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [extraDays, setExtraDays] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const monthlyPrice = getMonthlyPriceForTier({
    customPrice: clinic.customMonthlyPrice,
    founderPrice: clinic.planFounderMonthlyPrices[currentPlanId] ?? null,
    priceTier: clinic.priceTier,
    standardPrice: clinic.planMonthlyPrices[currentPlanId] ?? null,
  })
  const calculation = useMemo(
    () =>
      calculateSubscriptionPayment({
        billingCycle,
        customDays,
        discountPercent,
        manualAmount,
        monthlyPrice,
      }),
    [billingCycle, customDays, discountPercent, manualAmount, monthlyPrice],
  )
  const finalAmount = amountOverride === '' ? calculation.amountPaid : Number(amountOverride)
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

  function handleCycleChange(cycle: BillingCycle) {
    setBillingCycle(cycle)
    setDiscountPercent(suggestedDiscounts[cycle])
    setAmountOverride('')
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      setFeedback('Ingresa un monto válido para registrar el pago.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')
    const result = await registerSubscriptionPayment({
      amountPaid: finalAmount,
      billingCycle,
      clinicId: clinic.clinicId,
      customDays: calculation.customDays,
      discountPercent: calculation.discountPercent,
      isLifetime: billingCycle === 'lifetime',
      notes,
      paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
      planId: currentPlanId,
      reference,
    })
    setFeedback(result.error ?? 'Pago registrado y suscripción actualizada.')
    if (result.success) await onUpdated()
    setIsSubmitting(false)
  }

  async function handlePlanChange() {
    if (changeKind === 'same') {
      setFeedback('Selecciona un plan diferente.')
      return
    }
    if (forcePlanChange) {
      await runAction({ action: 'force_change_plan', clinicId: clinic.clinicId, notes, planId })
      return
    }
    if (changeKind === 'downgrade') {
      await runAction({ action: 'change_plan', clinicId: clinic.clinicId, notes, planId })
      return
    }
    if (upgradeProration.amount <= 0) {
      setFeedback('No hay días o diferencia de precio para calcular el upgrade.')
      return
    }
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback('')
    const result = await registerSubscriptionPayment({
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
      reference,
    })
    setFeedback(result.error ?? 'Upgrade registrado sin modificar el vencimiento actual.')
    if (result.success) await onUpdated()
    setIsSubmitting(false)
  }

  async function runAction(input: UpdateClinicSubscriptionInput) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback('')
    const result = await updateClinicSubscription(input)
    setFeedback(result.error ?? 'Suscripción actualizada correctamente.')
    if (result.success) await onUpdated()
    setIsSubmitting(false)
  }

  return (
    <section className="subscription-admin" aria-labelledby="subscription-admin-title">
      <header className="subscription-admin-header">
        <div>
          <h2 id="subscription-admin-title">Suscripción de {clinic.clinicName}</h2>
          <p>Valida el comprobante antes de registrar cualquier pago.</p>
        </div>
        <button className="secondary-action" onClick={onClose} type="button">
          Cerrar gestión
        </button>
      </header>

      <dl className="subscription-facts">
        <div><dt>Plan</dt><dd>{clinic.planName ?? 'Sin plan'}</dd></div>
        <div><dt>Tarifa</dt><dd>{priceTierLabel(clinic.priceTier)}</dd></div>
        <div><dt>Precio mensual</dt><dd>{monthlyPrice === null ? 'No configurado' : `${monthlyPrice.toFixed(2)} ${clinic.currency}`}</dd></div>
        <div><dt>Estado</dt><dd>{clinic.isLifetime ? 'Vitalicio' : clinic.subscriptionStatus ?? 'Sin estado'}</dd></div>
        <div><dt>Prueba hasta</dt><dd>{formatOptionalDate(clinic.trialEndsAt)}</dd></div>
        <div><dt>Pagado hasta</dt><dd>{clinic.isLifetime ? 'Sin vencimiento' : formatOptionalDate(clinic.currentPeriodEndsAt)}</dd></div>
        <div><dt>Gracia hasta</dt><dd>{clinic.isLifetime ? 'No aplica' : formatOptionalDate(clinic.graceEndsAt)}</dd></div>
        <div><dt>Último pago</dt><dd>{formatOptionalDate(clinic.lastPaymentAt)}</dd></div>
        <div><dt>Días restantes</dt><dd>{getDaysRemainingLabel(clinic.currentPeriodEndsAt, clinic.isLifetime)}</dd></div>
        <div><dt>Próximo plan</dt><dd>{clinic.scheduledPlanId ? `${clinic.scheduledPlanId} · ${formatOptionalDate(clinic.scheduledPlanStartsAt)}` : 'Sin cambio programado'}</dd></div>
      </dl>

      <div className="subscription-admin-grid">
        <form className="subscription-payment-form" onSubmit={handlePaymentSubmit}>
          <div className="section-heading">
            <h3>Registrar pago por QR</h3>
            <p className="section-description">Verifica el comprobante antes de registrar el pago.</p>
          </div>

          <div className="subscription-form-grid">
            <label>Plan actual<input readOnly value={currentPlanId} /></label>
            <label>Tipo de precio<input readOnly value={priceTierLabel(clinic.priceTier)} /></label>
            <label>Periodo
              <select value={billingCycle} onChange={(event) => handleCycleChange(event.target.value as BillingCycle)}>
                {Object.entries(cycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {billingCycle === 'custom_days' ? (
              <label>Días de acceso<input min="1" onChange={(event) => setCustomDays(Number(event.target.value))} type="number" value={customDays} /></label>
            ) : null}
            {(monthlyPrice === null || billingCycle === 'lifetime') ? (
              <label>Monto base manual<input min="0.01" onChange={(event) => setManualAmount(Number(event.target.value))} step="0.01" type="number" value={manualAmount || ''} /></label>
            ) : (
              <label>Precio mensual<input readOnly value={`${monthlyPrice.toFixed(2)} ${clinic.currency}`} /></label>
            )}
            <label>Descuento (%)<input max="100" min="0" onChange={(event) => { setDiscountPercent(Number(event.target.value)); setAmountOverride('') }} step="0.01" type="number" value={discountPercent} /></label>
            <label>Monto final ({clinic.currency})<input min="0.01" onChange={(event) => setAmountOverride(event.target.value)} step="0.01" type="number" value={amountOverride === '' ? calculation.amountPaid : amountOverride} /></label>
            <label>Fecha de pago<input onChange={(event) => setPaidAt(event.target.value)} type="date" value={paidAt} /></label>
            <label>Referencia<input onChange={(event) => setReference(event.target.value)} placeholder="Número o nombre del comprobante" value={reference} /></label>
            <label className="subscription-field-wide">Notas<textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} /></label>
          </div>

          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Registrando pago…' : 'Registrar pago'}
          </button>
        </form>

        <aside className="subscription-payment-aside">
          <PaymentQr planId={currentPlanId} planName={currentPlanId} />
          <p>El QR corresponde al plan seleccionado. El periodo cambia el monto, no la imagen.</p>
        </aside>
      </div>

      <section className="subscription-actions" aria-labelledby="plan-change-title">
        <div className="section-heading">
          <h3 id="plan-change-title">Cambio de plan</h3>
          <p className="section-description">Los upgrades se cobran ahora y conservan el vencimiento. Los downgrades comienzan al terminar el periodo.</p>
        </div>
        <div className="subscription-plan-change-grid">
          <div className="subscription-action-row">
            <label>Nuevo plan<select value={planId} onChange={(event) => setPlanId(event.target.value as PlatformClinicPlanId)}><option value="basic">Basic</option><option value="medium">Medium</option><option value="pro">Pro</option></select></label>
            <p>{changeKind === 'upgrade' ? `Prorrateo: ${upgradeProration.amount.toFixed(2)} ${clinic.currency} por ${upgradeProration.daysRemaining} días` : changeKind === 'downgrade' ? `Se programará para ${formatOptionalDate(clinic.currentPeriodEndsAt)}` : 'Selecciona un plan distinto.'}</p>
            <label className="subscription-checkbox"><input checked={forcePlanChange} onChange={(event) => setForcePlanChange(event.target.checked)} type="checkbox" /> Forzar cambio inmediato</label>
            <button className="secondary-action" disabled={isSubmitting || changeKind === 'same'} onClick={() => void handlePlanChange()} type="button">{forcePlanChange ? 'Aplicar excepción' : changeKind === 'upgrade' ? 'Registrar upgrade' : 'Programar downgrade'}</button>
          </div>
          {changeKind === 'upgrade' ? <div className="subscription-upgrade-qr"><PaymentQr planId={planId} planName={planId} /><span>QR del nuevo plan</span></div> : null}
        </div>
        {forcePlanChange ? <p className="section-description">La nota general es obligatoria y quedará en auditoría.</p> : null}
      </section>

      <section className="subscription-actions" aria-labelledby="pricing-title">
        <div className="section-heading"><h3 id="pricing-title">Condición comercial</h3><p className="section-description">La tarifa fundador se conserva durante el periodo activo y la gracia hasta que un administrador la retire.</p></div>
        <div className="subscription-action-row">
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'set_founder_price', clinicId: clinic.clinicId, notes })} type="button">Asignar fundador</button>
          <label>Precio personalizado<input min="0" onChange={(event) => setCustomMonthlyPrice(Number(event.target.value))} step="0.01" type="number" value={customMonthlyPrice} /></label>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'set_custom_price', clinicId: clinic.clinicId, customMonthlyPrice, notes })} type="button">Aplicar personalizado</button>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'set_standard_price', clinicId: clinic.clinicId, notes })} type="button">{clinic.priceTier === 'founder' ? 'Quitar fundador y usar estándar' : 'Usar tarifa estándar'}</button>
        </div>
      </section>

      <section className="subscription-actions" aria-labelledby="subscription-actions-title">
        <h3 id="subscription-actions-title">Acciones administrativas</h3>
        <div className="subscription-action-row">
          <label>Días adicionales<input min="1" onChange={(event) => setExtraDays(Number(event.target.value))} type="number" value={extraDays} /></label>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'grant_extra_days', clinicId: clinic.clinicId, days: extraDays, notes })} type="button">Aumentar días</button>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'reactivate', clinicId: clinic.clinicId })} type="button">Reactivar acceso</button>
          <button className="danger-action" disabled={isSubmitting} onClick={() => setIsBlockDialogOpen(true)} type="button">Bloquear consultorio</button>
        </div>
      </section>

      {feedback ? <p className="subscription-feedback" role="status">{feedback}</p> : null}

      <section className="subscription-payment-history" aria-labelledby="payment-history-title">
        <h3 id="payment-history-title">Historial de pagos</h3>
        {clinic.payments.length === 0 ? <p>No hay pagos registrados todavía.</p> : (
          <div className="platform-clinics-table-wrap"><table className="platform-clinics-table"><thead><tr><th>Fecha</th><th>Plan y periodo</th><th>Monto</th><th>Descuento</th><th>Referencia</th><th>Registrado por</th></tr></thead><tbody>
            {clinic.payments.map((payment) => <tr key={payment.id}><td>{formatOptionalDate(payment.paidAt)}</td><td>{payment.planId} · {payment.paymentType === 'upgrade_proration' ? 'Upgrade prorrateado' : cycleLabels[payment.billingCycle as BillingCycle] ?? payment.billingCycle}</td><td>{payment.amountPaid.toFixed(2)} {payment.currency}</td><td>{payment.discountPercent}%</td><td>{payment.reference ?? 'Sin referencia'}</td><td>{payment.recordedBy ?? 'Administrador DayIA'}</td></tr>)}
          </tbody></table></div>
        )}
      </section>

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

function normalizePlan(planId: string | null): PlatformClinicPlanId {
  return planId === 'medium' || planId === 'pro' ? planId : 'basic'
}

function formatOptionalDate(value: string | null) {
  return value ? formatAppDate(value.slice(0, 10)) : 'No definido'
}

function priceTierLabel(tier: PlatformClinicSummary['priceTier']) {
  if (tier === 'founder') return 'Fundador'
  if (tier === 'custom') return 'Personalizada'
  return 'Estándar'
}

function getDaysRemainingLabel(periodEndsAt: string | null, isLifetime: boolean) {
  if (isLifetime) return 'Sin límite'
  if (!periodEndsAt) return 'No definido'
  const difference = new Date(periodEndsAt).getTime() - Date.now()
  if (!Number.isFinite(difference)) return 'No definido'
  return `${Math.max(0, Math.ceil(difference / 86_400_000))} días`
}
