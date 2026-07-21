export type BillingCycle =
  | 'monthly'
  | 'six_months'
  | 'annual'
  | 'custom_days'
  | 'lifetime'

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

  if (!uuidPattern.test(clinicId)) throw invalid('Selecciona un consultorio válido.')
  if (!plans.has(planId)) throw invalid('Selecciona un plan válido.')
  if (!cycles.has(billingCycle)) throw invalid('Selecciona un periodo válido.')
  if (!(amountPaid > 0)) throw invalid('Ingresa un monto pagado válido.')
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
  const expectedPaid = round(amountDue * discountFactor)

  if (monthlyPrice !== null && !input.isLifetime && Math.abs(expectedPaid - input.amountPaid) > 0.01) {
    throw invalid('El monto pagado no coincide con el precio y descuento configurados.')
  }

  if (input.isLifetime) {
    return {
      amountDue,
      amountPaid: input.amountPaid,
      discountAmount: round(amountDue - input.amountPaid),
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
    discountAmount: round(amountDue - input.amountPaid),
    graceEndsAt: addUtcDays(periodEndsAt, 5).toISOString(),
    periodEndsAt: periodEndsAt.toISOString(),
    periodStartsAt: startsAt.toISOString(),
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
