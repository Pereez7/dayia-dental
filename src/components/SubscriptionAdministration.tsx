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
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [customDays, setCustomDays] = useState(30)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [manualAmount, setManualAmount] = useState(0)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [extraDays, setExtraDays] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const monthlyPrice = clinic.planMonthlyPrices[planId] ?? null
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

  function handleCycleChange(cycle: BillingCycle) {
    setBillingCycle(cycle)
    setDiscountPercent(suggestedDiscounts[cycle])
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (calculation.amountPaid <= 0) {
      setFeedback('Ingresa un monto válido para registrar el pago.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')
    const result = await registerSubscriptionPayment({
      amountPaid: calculation.amountPaid,
      billingCycle,
      clinicId: clinic.clinicId,
      customDays: calculation.customDays,
      discountPercent: calculation.discountPercent,
      isLifetime: billingCycle === 'lifetime',
      notes,
      paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
      planId,
      reference,
    })
    setIsSubmitting(false)
    setFeedback(result.error ?? 'Pago registrado y suscripción actualizada.')
    if (result.success) await onUpdated()
  }

  async function runAction(input: UpdateClinicSubscriptionInput) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback('')
    const result = await updateClinicSubscription(input)
    setIsSubmitting(false)
    setFeedback(result.error ?? 'Suscripción actualizada correctamente.')
    if (result.success) await onUpdated()
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
        <div><dt>Estado</dt><dd>{clinic.isLifetime ? 'Vitalicio' : clinic.subscriptionStatus ?? 'Sin estado'}</dd></div>
        <div><dt>Prueba hasta</dt><dd>{formatOptionalDate(clinic.trialEndsAt)}</dd></div>
        <div><dt>Pagado hasta</dt><dd>{clinic.isLifetime ? 'Sin vencimiento' : formatOptionalDate(clinic.currentPeriodEndsAt)}</dd></div>
        <div><dt>Gracia hasta</dt><dd>{clinic.isLifetime ? 'No aplica' : formatOptionalDate(clinic.graceEndsAt)}</dd></div>
        <div><dt>Último pago</dt><dd>{formatOptionalDate(clinic.lastPaymentAt)}</dd></div>
      </dl>

      <div className="subscription-admin-grid">
        <form className="subscription-payment-form" onSubmit={handlePaymentSubmit}>
          <div className="section-heading">
            <h3>Registrar pago por QR</h3>
            <p className="section-description">Verifica el comprobante antes de registrar el pago.</p>
          </div>

          <div className="subscription-form-grid">
            <label>Plan
              <select value={planId} onChange={(event) => setPlanId(event.target.value as PlatformClinicPlanId)}>
                <option value="basic">Basic</option><option value="medium">Medium</option><option value="pro">Pro</option>
              </select>
            </label>
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
            <label>Descuento (%)<input max="100" min="0" onChange={(event) => setDiscountPercent(Number(event.target.value))} step="0.01" type="number" value={discountPercent} /></label>
            <label>Monto final<input readOnly value={`${calculation.amountPaid.toFixed(2)} ${clinic.currency}`} /></label>
            <label>Fecha de pago<input onChange={(event) => setPaidAt(event.target.value)} type="date" value={paidAt} /></label>
            <label>Referencia<input onChange={(event) => setReference(event.target.value)} placeholder="Número o nombre del comprobante" value={reference} /></label>
            <label className="subscription-field-wide">Notas<textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} /></label>
          </div>

          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Registrando pago…' : 'Registrar pago'}
          </button>
        </form>

        <aside className="subscription-payment-aside">
          <PaymentQr planId={planId} planName={planId} />
          <p>El QR corresponde al plan seleccionado. El periodo cambia el monto, no la imagen.</p>
        </aside>
      </div>

      <section className="subscription-actions" aria-labelledby="subscription-actions-title">
        <h3 id="subscription-actions-title">Acciones administrativas</h3>
        <div className="subscription-action-row">
          <label>Días adicionales<input min="1" onChange={(event) => setExtraDays(Number(event.target.value))} type="number" value={extraDays} /></label>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'grant_extra_days', clinicId: clinic.clinicId, days: extraDays, notes })} type="button">Aumentar días</button>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'change_plan', clinicId: clinic.clinicId, planId })} type="button">Cambiar plan</button>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'reactivate', clinicId: clinic.clinicId })} type="button">Reactivar acceso</button>
          <button className="secondary-action" disabled={isSubmitting} onClick={() => runAction({ action: 'mark_lifetime', clinicId: clinic.clinicId })} type="button">Marcar vitalicio</button>
          <button className="danger-action" disabled={isSubmitting} onClick={() => setIsBlockDialogOpen(true)} type="button">Bloquear consultorio</button>
        </div>
      </section>

      {feedback ? <p className="subscription-feedback" role="status">{feedback}</p> : null}

      <section className="subscription-payment-history" aria-labelledby="payment-history-title">
        <h3 id="payment-history-title">Historial de pagos</h3>
        {clinic.payments.length === 0 ? <p>No hay pagos registrados todavía.</p> : (
          <div className="platform-clinics-table-wrap"><table className="platform-clinics-table"><thead><tr><th>Fecha</th><th>Plan y periodo</th><th>Monto</th><th>Descuento</th><th>Referencia</th><th>Registrado por</th></tr></thead><tbody>
            {clinic.payments.map((payment) => <tr key={payment.id}><td>{formatOptionalDate(payment.paidAt)}</td><td>{payment.planId} · {cycleLabels[payment.billingCycle as BillingCycle] ?? payment.billingCycle}</td><td>{payment.amountPaid.toFixed(2)} {payment.currency}</td><td>{payment.discountPercent}%</td><td>{payment.reference ?? 'Sin referencia'}</td><td>{payment.recordedBy ?? 'Administrador DayIA'}</td></tr>)}
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
