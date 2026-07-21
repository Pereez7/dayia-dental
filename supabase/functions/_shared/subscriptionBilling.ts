export type BillingCycle =
  | 'monthly'
  | 'six_months'
  | 'annual'
  | 'custom_days'
  | 'lifetime'
export type PriceTier = 'standard' | 'founder' | 'custom'
export type PaymentType = 'regular' | 'upgrade_proration' | 'custom_days' | 'lifetime' | 'manual_adjustment'

export interface RegisterPaymentInput {
  amountPaid: number
  billingCycle: BillingCycle
  clinicId: string
  customDays: number | null
  discountPercent: number
  isLifetime: boolean
  monthsCovered: number | null
  notes: string
  paidAt: string
  planId: 'basic' | 'medium' | 'pro'
  paymentType: PaymentType
  reference: string
}

export interface CalculatedPayment {
  amountDue: number
  amountPaid: number
  discountAmount: number
  graceEndsAt: string | null
  periodEndsAt: string | null
  periodStartsAt: string
}

export class SubscriptionBillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'SubscriptionBillingError'
  }
}

export function assertPlatformBillingAdmin(isPlatformAdmin: boolean) {
  if (!isPlatformAdmin) {
    throw new SubscriptionBillingError(
      'FORBIDDEN',
      'No tienes permiso para administrar suscripciones.',
      403,
    )
  }
}

const cycles = new Set<BillingCycle>([
  'monthly',
  'six_months',
  'annual',
  'custom_days',
  'lifetime',
])
const plans = new Set(['basic', 'medium', 'pro'])
const paymentTypes = new Set<PaymentType>(['regular', 'upgrade_proration', 'custom_days', 'lifetime', 'manual_adjustment'])
const planRanks = { basic: 0, medium: 1, pro: 2 } as const
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeRegisterPaymentPayload(
  payload: unknown,
): RegisterPaymentInput {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalid('Revisa los datos del pago.')
  }

  const value = payload as Record<string, unknown>
  const clinicId = stringValue(value.clinicId)
  const planId = stringValue(value.planId).toLowerCase()
  const billingCycle = stringValue(value.billingCycle) as BillingCycle
  const isLifetime = value.isLifetime === true || billingCycle === 'lifetime'
  const amountPaid = numberValue(value.amountPaid)
  const discountPercent = numberValue(value.discountPercent, 0)
  const customDays = nullableInteger(value.customDays)
  const paidAt = stringValue(value.paidAt) || new Date().toISOString()
  const defaultPaymentType = billingCycle === 'custom_days'
    ? 'custom_days'
    : isLifetime ? 'lifetime' : 'regular'
  const paymentType = (stringValue(value.paymentType) || defaultPaymentType) as PaymentType

  if (!uuidPattern.test(clinicId)) throw invalid('Selecciona un consultorio válido.')
  if (!plans.has(planId)) throw invalid('Selecciona un plan válido.')
  if (!cycles.has(billingCycle)) throw invalid('Selecciona un periodo válido.')
  if (!paymentTypes.has(paymentType)) throw invalid('Selecciona un tipo de pago válido.')
  if (!(amountPaid > 0)) throw invalid('Ingresa un monto pagado válido.')
  if (!stringValue(value.reference)) {
    throw invalid('Ingresa la referencia del comprobante.')
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw invalid('El descuento debe estar entre 0 y 100%.')
  }
  if (billingCycle === 'custom_days' && (!customDays || customDays < 1)) {
    throw invalid('Ingresa al menos un día de acceso.')
  }
  if (Number.isNaN(Date.parse(paidAt))) throw invalid('Ingresa una fecha de pago válida.')

  return {
    amountPaid: round(amountPaid),
    billingCycle,
    clinicId,
    customDays: billingCycle === 'custom_days' ? customDays : null,
    discountPercent: round(discountPercent),
    isLifetime,
    monthsCovered: getMonths(billingCycle),
    notes: stringValue(value.notes).slice(0, 1000),
    paidAt: new Date(paidAt).toISOString(),
    planId: planId as RegisterPaymentInput['planId'],
    paymentType,
    reference: stringValue(value.reference).slice(0, 200),
  }
}

export function calculatePaymentRegistration({
  currentPeriodEndsAt,
  input,
  monthlyPrice,
  now = new Date(),
}: {
  currentPeriodEndsAt: string | null
  input: RegisterPaymentInput
  monthlyPrice: number | null
  now?: Date
}): CalculatedPayment {
  const currentEnd = parseDate(currentPeriodEndsAt)
  const startsAt = currentEnd && currentEnd > now ? currentEnd : now
  const discountFactor = 1 - input.discountPercent / 100
  let amountDue: number

  if (input.isLifetime || monthlyPrice === null) {
    amountDue = input.amountPaid / Math.max(discountFactor, 0.0001)
  } else if (input.billingCycle === 'custom_days') {
    amountDue = (monthlyPrice / 30) * (input.customDays ?? 0)
  } else {
    amountDue = monthlyPrice * (input.monthsCovered ?? 0)
  }

  amountDue = round(amountDue)
  if (input.isLifetime) {
    return {
      amountDue,
      amountPaid: input.amountPaid,
      discountAmount: round(amountDue * (input.discountPercent / 100)),
      graceEndsAt: null,
      periodEndsAt: null,
      periodStartsAt: startsAt.toISOString(),
    }
  }

  const periodEndsAt = input.monthsCovered
    ? addUtcMonths(startsAt, input.monthsCovered)
    : addUtcDays(startsAt, input.customDays ?? 0)

  return {
    amountDue,
    amountPaid: input.amountPaid,
    discountAmount: round(Math.max(0, amountDue - input.amountPaid)),
    graceEndsAt: addUtcDays(periodEndsAt, 5).toISOString(),
    periodEndsAt: periodEndsAt.toISOString(),
    periodStartsAt: startsAt.toISOString(),
  }
}

export function isFounderPricingEligible({
  blockedAt,
  paidAt,
  graceHours = 24,
}: {
  blockedAt: string | null | undefined
  paidAt: string | Date
  graceHours?: number
}) {
  if (!blockedAt) return true

  const blockedTime = new Date(blockedAt).getTime()
  const paymentTime = new Date(paidAt).getTime()
  if (!Number.isFinite(blockedTime) || !Number.isFinite(paymentTime)) return false

  return paymentTime <= blockedTime + graceHours * 60 * 60 * 1000
}

export function getEffectiveMonthlyPrice({
  customPrice,
  founderPrice,
  priceTier,
  standardPrice,
}: {
  customPrice: number | null
  founderPrice: number | null
  priceTier: PriceTier
  standardPrice: number | null
}) {
  if (priceTier === 'custom') return customPrice
  if (priceTier === 'founder') return founderPrice ?? standardPrice
  return standardPrice
}

export function getPlanChangeKind(currentPlanId: string, newPlanId: string) {
  const current = planRanks[currentPlanId as keyof typeof planRanks]
  const next = planRanks[newPlanId as keyof typeof planRanks]
  if (current === undefined || next === undefined || current === next) return 'same'
  return next > current ? 'upgrade' : 'downgrade'
}

export function getScheduledDowngradeUpdate(
  currentPeriodEndsAt: string | null,
  newPlanId: 'basic' | 'medium' | 'pro',
) {
  const startsAt = parseDate(currentPeriodEndsAt)
  if (!startsAt) throw invalid('Define primero el vencimiento del periodo actual.')
  return {
    scheduled_plan_id: newPlanId,
    scheduled_plan_starts_at: startsAt.toISOString(),
  }
}

export function calculateUpgradeProration({
  currentMonthlyPrice,
  currentPeriodEndsAt,
  newMonthlyPrice,
  now = new Date(),
}: {
  currentMonthlyPrice: number | null
  currentPeriodEndsAt: string | null
  newMonthlyPrice: number | null
  now?: Date
}) {
  const end = parseDate(currentPeriodEndsAt)
  const daysRemaining = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)) : 0
  return {
    amount: round((Math.max(0, (newMonthlyPrice ?? 0) - (currentMonthlyPrice ?? 0)) / 30) * daysRemaining),
    daysRemaining,
  }
}

export function calculateExtraDaysPeriod(
  currentPeriodEndsAt: string | null,
  days: number,
  now = new Date(),
) {
  const existingEnd = parseDate(currentPeriodEndsAt)
  const startsAt = existingEnd && existingEnd > now ? existingEnd : now
  const periodEndsAt = addUtcDays(startsAt, days)

  return {
    graceEndsAt: addUtcDays(periodEndsAt, 5).toISOString(),
    periodEndsAt: periodEndsAt.toISOString(),
  }
}

function getMonths(cycle: BillingCycle) {
  if (cycle === 'monthly') return 1
  if (cycle === 'six_months') return 6
  if (cycle === 'annual') return 12
  return null
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000)
}

function addUtcMonths(date: Date, months: number) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown, fallback = Number.NaN) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function nullableInteger(value: unknown) {
  const number = numberValue(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function invalid(message: string) {
  return new SubscriptionBillingError('INVALID_PAYLOAD', message, 400)
}
