export type BillingCycle =
  | 'monthly'
  | 'six_months'
  | 'annual'
  | 'custom_days'
  | 'lifetime'

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

export const suggestedDiscounts: Record<BillingCycle, number> = {
  annual: 20,
  custom_days: 0,
  lifetime: 0,
  monthly: 0,
  six_months: 10,
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
