export type BillingCycle =
  | 'monthly'
  | 'six_months'
  | 'annual'
  | 'custom_days'
  | 'lifetime'

export type PriceTier = 'standard' | 'founder' | 'custom'
export type PaymentType =
  | 'regular'
  | 'upgrade_proration'
  | 'custom_days'
  | 'lifetime'
  | 'manual_adjustment'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'blocked'
  | 'cancelled'
  | 'lifetime'

export interface SubscriptionAccessInput {
  currentPeriodEndsAt: string | null
  graceEndsAt: string | null
  isLifetime: boolean
  status: SubscriptionStatus
  trialEndsAt: string | null
}

export interface SubscriptionAccessState {
  access: 'active' | 'grace' | 'blocked' | 'lifetime'
  daysRemaining: number | null
  notice: 'trial_ending' | 'subscription_ending' | 'grace' | null
}

export interface PaymentCalculationInput {
  billingCycle: BillingCycle
  customDays?: number
  discountPercent?: number
  manualAmount?: number
  monthlyPrice: number | null
}

export interface PaymentCalculation {
  amountDue: number
  amountPaid: number
  customDays: number | null
  discountAmount: number
  discountPercent: number
  monthsCovered: number | null
}

const millisecondsPerDay = 86_400_000
const planRanks = { basic: 0, medium: 1, pro: 2 } as const

export const suggestedDiscounts: Record<BillingCycle, number> = {
  annual: 20,
  custom_days: 0,
  lifetime: 0,
  monthly: 0,
  six_months: 10,
}

export interface TieredPaymentCalculationInput
  extends Omit<PaymentCalculationInput, 'monthlyPrice'> {
  effectiveMonthlyPrice: number | null
  priceTier: PriceTier
  standardMonthlyPrice: number | null
}

export function shouldBlockImplicitPaymentSubmit(key: string) {
  return key === 'Enter'
}

export function validateSubscriptionPayment({
  billingCycle,
  customDays,
  discountPercent,
  finalAmount,
  paidAt,
  reference,
}: {
  billingCycle: BillingCycle
  customDays: number
  discountPercent: number
  finalAmount: number
  paidAt: string
  reference: string
}) {
  const errors: Record<string, string> = {}

  if (
    !Number.isFinite(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    errors.discountPercent = 'El descuento debe estar entre 0 y 100%.'
  }
  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    errors.finalAmount = 'El monto final debe ser mayor a 0.'
  }
  if (!paidAt || Number.isNaN(Date.parse(paidAt))) {
    errors.paidAt = 'Selecciona una fecha de pago válida.'
  }
  if (!reference.trim()) {
    errors.reference = 'Ingresa la referencia del comprobante.'
  }
  if (
    billingCycle === 'custom_days' &&
    (!Number.isInteger(customDays) || customDays < 1)
  ) {
    errors.customDays = 'Ingresa al menos un día de acceso.'
  }

  return errors
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

export function calculateSubscriptionPayment({
  billingCycle,
  customDays,
  discountPercent = suggestedDiscounts[billingCycle],
  manualAmount,
  monthlyPrice,
}: PaymentCalculationInput): PaymentCalculation {
  const normalizedDiscount = clamp(roundCurrency(discountPercent), 0, 100)
  const monthsCovered = getMonthsForCycle(billingCycle)
  const normalizedCustomDays =
    billingCycle === 'custom_days'
      ? Math.max(1, Math.trunc(customDays ?? 0))
      : null

  let amountDue: number

  if (billingCycle === 'lifetime') {
    amountDue = Math.max(0, manualAmount ?? 0)
  } else if (billingCycle === 'custom_days') {
    amountDue =
      monthlyPrice === null
        ? Math.max(0, manualAmount ?? 0)
        : (monthlyPrice / 30) * (normalizedCustomDays ?? 0)
  } else {
    amountDue =
      monthlyPrice === null
        ? Math.max(0, manualAmount ?? 0)
        : monthlyPrice * (monthsCovered ?? 0)
  }

  amountDue = roundCurrency(amountDue)
  const discountAmount = roundCurrency(
    amountDue * (normalizedDiscount / 100),
  )

  return {
    amountDue,
    amountPaid: roundCurrency(amountDue - discountAmount),
    customDays: normalizedCustomDays,
    discountAmount,
    discountPercent: normalizedDiscount,
    monthsCovered,
  }
}

export function calculateTieredSubscriptionPayment({
  billingCycle,
  customDays,
  discountPercent,
  effectiveMonthlyPrice,
  manualAmount,
  priceTier,
  standardMonthlyPrice,
}: TieredPaymentCalculationInput): PaymentCalculation {
  const usesFounderMonthlyPrice =
    priceTier === 'founder' &&
    billingCycle === 'monthly' &&
    standardMonthlyPrice !== null &&
    effectiveMonthlyPrice !== null

  if (usesFounderMonthlyPrice) {
    const amountDue = roundCurrency(standardMonthlyPrice)
    const amountPaid = roundCurrency(
      Math.min(amountDue, Math.max(0, effectiveMonthlyPrice)),
    )
    const discountAmount = roundCurrency(amountDue - amountPaid)

    return {
      amountDue,
      amountPaid,
      customDays: null,
      discountAmount,
      discountPercent:
        amountDue > 0
          ? roundCurrency((discountAmount / amountDue) * 100)
          : 0,
      monthsCovered: 1,
    }
  }

  const monthlyPrice =
    priceTier === 'founder'
      ? standardMonthlyPrice
      : effectiveMonthlyPrice

  return calculateSubscriptionPayment({
    billingCycle,
    customDays,
    discountPercent,
    manualAmount,
    monthlyPrice,
  })
}

export function calculateNewSubscriptionPeriod({
  billingCycle,
  currentPeriodEndsAt,
  customDays,
  now = new Date(),
}: {
  billingCycle: BillingCycle
  currentPeriodEndsAt: string | null
  customDays?: number
  now?: Date
}) {
  const currentEnd = parseDate(currentPeriodEndsAt)
  const startsAt = currentEnd && currentEnd > now ? currentEnd : now

  if (billingCycle === 'lifetime') {
    return {
      graceEndsAt: null,
      periodEndsAt: null,
      periodStartsAt: startsAt.toISOString(),
    }
  }

  const months = getMonthsForCycle(billingCycle)
  const periodEndsAt = months
    ? addUtcMonths(startsAt, months)
    : addUtcDays(startsAt, Math.max(1, Math.trunc(customDays ?? 0)))

  return {
    graceEndsAt: addUtcDays(periodEndsAt, 5).toISOString(),
    periodEndsAt: periodEndsAt.toISOString(),
    periodStartsAt: startsAt.toISOString(),
  }
}

export function getSubscriptionAccessState(
  subscription: SubscriptionAccessInput | null,
  now = new Date(),
): SubscriptionAccessState {
  if (!subscription) {
    return { access: 'active', daysRemaining: null, notice: null }
  }

  if (
    subscription.status === 'blocked' ||
    subscription.status === 'cancelled'
  ) {
    return { access: 'blocked', daysRemaining: 0, notice: null }
  }

  if (subscription.isLifetime || subscription.status === 'lifetime') {
    return { access: 'lifetime', daysRemaining: null, notice: null }
  }

  const isTrial = subscription.status === 'trialing'
  const periodEnd = parseDate(
    isTrial ? subscription.trialEndsAt : subscription.currentPeriodEndsAt,
  )
  const graceEnd = parseDate(subscription.graceEndsAt)

  if (!periodEnd) {
    return { access: 'active', daysRemaining: null, notice: null }
  }

  if (now <= periodEnd) {
    const daysRemaining = getDaysRemaining(periodEnd, now)

    return {
      access: 'active',
      daysRemaining,
      notice:
        daysRemaining <= 5
          ? isTrial
            ? 'trial_ending'
            : 'subscription_ending'
          : null,
    }
  }

  if (graceEnd && now <= graceEnd) {
    return {
      access: 'grace',
      daysRemaining: getDaysRemaining(graceEnd, now),
      notice: 'grace',
    }
  }

  return { access: 'blocked', daysRemaining: 0, notice: null }
}

export function getPlanQrPath(planId: string | null | undefined) {
  return planId === 'basic' || planId === 'medium' || planId === 'pro'
    ? `/payment-qr/${planId}.png`
    : null
}

export function getMonthlyPriceForTier({
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
  const periodEnd = parseDate(currentPeriodEndsAt)
  const daysRemaining = periodEnd ? getDaysRemaining(periodEnd, now) : 0
  const priceDifference = Math.max(0, (newMonthlyPrice ?? 0) - (currentMonthlyPrice ?? 0))
  return {
    amount: roundCurrency((priceDifference / 30) * daysRemaining),
    daysRemaining,
  }
}

export function calculateExtraDaysPreview(
  currentPeriodEndsAt: string | null,
  days: number,
  now = new Date(),
) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return null
  }

  const existingEnd = parseDate(currentPeriodEndsAt)
  const startsAt = existingEnd && existingEnd > now ? existingEnd : now
  const periodEndsAt = addUtcDays(startsAt, days)

  return {
    graceEndsAt: addUtcDays(periodEndsAt, 5).toISOString(),
    periodEndsAt: periodEndsAt.toISOString(),
  }
}

function getMonthsForCycle(billingCycle: BillingCycle) {
  if (billingCycle === 'monthly') return 1
  if (billingCycle === 'six_months') return 6
  if (billingCycle === 'annual') return 12
  return null
}

function getDaysRemaining(end: Date, now: Date) {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / millisecondsPerDay))
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * millisecondsPerDay)
}

function addUtcMonths(date: Date, months: number) {
  const result = new Date(date)
  const targetDay = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(targetDay, lastDay))
  return result
}

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function roundCurrency(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
