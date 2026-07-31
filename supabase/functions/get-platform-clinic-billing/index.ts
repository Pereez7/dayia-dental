import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  normalizeSubscriptionStatus,
  resolveClinicStatus,
  selectPrimaryOwner,
} from '../_shared/platformAdmin.ts'

interface PublicError {
  code: string
  message: string
}

interface SupabaseClientConfig {
  anonKey: string
  serviceRoleKey: string
  supabaseUrl: string
}

interface PaymentCursor {
  createdAt: string
  id: string
  paidAt: string
}

interface SubmissionCursor {
  createdAt: string
  id: string
}

interface BillingInput {
  clinicId?: string
  paymentCursor?: PaymentCursor | null
  paymentLimit?: number
  submissionCursor?: SubmissionCursor | null
  submissionLimit?: number
}

const DEFAULT_HISTORY_PAGE_SIZE = 5
const MAX_HISTORY_PAGE_SIZE = 25
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    return await handleGetPlatformClinicBilling(request)
  } catch {
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos cargar la gestión del consultorio.',
      },
      500,
    )
  }
})

async function handleGetPlatformClinicBilling(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
      405,
    )
  }

  const inputResult = await parseInput(request)

  if ('error' in inputResult) {
    return errorResponse(inputResult.error, 400)
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!authHeader || !token) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  const configResult = getSupabaseClientConfig()

  if ('error' in configResult) {
    return errorResponse(configResult.error, 500)
  }

  const { anonKey, serviceRoleKey, supabaseUrl } = configResult.config
  const requesterClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: requesterData, error: requesterError } =
    await requesterClient.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  const { data: requesterProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', requesterData.user.id)
    .maybeSingle()

  if (profileError) {
    return dataQueryError()
  }

  if (requesterProfile?.is_platform_admin !== true) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para administrar suscripciones.',
      },
      403,
    )
  }

  const {
    clinicId,
    paymentCursor,
    paymentLimit,
    submissionCursor,
    submissionLimit,
  } = inputResult.input
  const { error: scheduledPlanError } = await adminClient.rpc(
    'apply_due_scheduled_plans',
    { target_clinic_ids: [clinicId] },
  )

  if (scheduledPlanError) {
    return dataQueryError()
  }

  let paymentsQuery = adminClient
    .from('subscription_payments')
    .select(
      'id, plan_id, billing_cycle, months_covered, custom_days, amount_due, discount_percent, discount_amount, amount_paid, currency, reference, notes, paid_at, period_starts_at, period_ends_at, recorded_by, payment_type, price_tier, previous_plan_id, new_plan_id, status, voided_at, voided_by, void_reason, created_at',
    )
    .eq('clinic_id', clinicId)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(paymentLimit + 1)

  if (paymentCursor) {
    paymentsQuery = paymentsQuery.or(
      buildPaymentCursorFilter(paymentCursor),
    )
  }

  let submissionsQuery = adminClient
    .from('subscription_payment_submissions')
    .select(
      'id, submitted_by, previous_plan_id, plan_id, billing_cycle, amount_expected, currency, reference, notes, payment_type, effective_at, status, created_at',
    )
    .eq('clinic_id', clinicId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(submissionLimit + 1)

  if (submissionCursor) {
    submissionsQuery = submissionsQuery.or(
      buildSubmissionCursorFilter(submissionCursor),
    )
  }

  const [
    clinicResult,
    subscriptionResult,
    membershipsResult,
    plansResult,
    paymentsResult,
    paymentsCountResult,
    submissionsResult,
    submissionsCountResult,
    latestRegisteredPaymentResult,
  ] = await Promise.all([
    adminClient
      .from('clinics')
      .select('id, name, status, created_at')
      .eq('id', clinicId)
      .maybeSingle(),
    adminClient
      .from('clinic_subscriptions')
      .select(
        'clinic_id, plan_id, status, trial_ends_at, current_period_ends_at, grace_ends_at, blocked_at, last_payment_at, payment_status, is_lifetime, price_tier, custom_monthly_price, founder_price_locked, scheduled_plan_id, scheduled_plan_starts_at',
      )
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    adminClient
      .from('clinic_memberships')
      .select(
        'clinic_id, user_id, role, status, invited_at, activated_at, created_at',
      )
      .eq('clinic_id', clinicId)
      .in('status', ['active', 'pending_activation'])
      .order('activated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    adminClient
      .from('plans')
      .select('id, name, monthly_price, founder_monthly_price, currency'),
    paymentsQuery,
    adminClient
      .from('subscription_payments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
    submissionsQuery,
    adminClient
      .from('subscription_payment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'pending_review'),
    adminClient
      .from('subscription_payments')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('status', 'registered')
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (
    clinicResult.error ||
    subscriptionResult.error ||
    membershipsResult.error ||
    plansResult.error ||
    paymentsResult.error ||
    paymentsCountResult.error ||
    submissionsResult.error ||
    submissionsCountResult.error ||
    latestRegisteredPaymentResult.error
  ) {
    return dataQueryError()
  }

  if (!clinicResult.data) {
    return errorResponse(
      {
        code: 'CLINIC_NOT_FOUND',
        message: 'No encontramos el consultorio solicitado.',
      },
      404,
    )
  }

  const subscription = subscriptionResult.data
  const lifetimePaymentResult = subscription?.is_lifetime
    ? await adminClient
        .from('subscription_payments')
        .select(
          'id, plan_id, billing_cycle, months_covered, custom_days, amount_due, discount_percent, discount_amount, amount_paid, currency, reference, notes, paid_at, period_starts_at, period_ends_at, recorded_by, payment_type, price_tier, previous_plan_id, new_plan_id, status, voided_at, voided_by, void_reason, created_at',
        )
        .eq('clinic_id', clinicId)
        .eq('status', 'registered')
        .eq('billing_cycle', 'lifetime')
        .order('paid_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null }

  if (lifetimePaymentResult.error) {
    return dataQueryError()
  }

  const memberships = membershipsResult.data ?? []
  const activeMembersCount = memberships.filter(
    (membership) => membership.status === 'active',
  ).length
  const ownerMemberships = memberships.filter(
    (membership) => membership.role === 'clinic_owner',
  )
  const paymentRows = paymentsResult.data ?? []
  const submissionRows = submissionsResult.data ?? []
  const profileIds = [
    ...new Set(
      [
        ...ownerMemberships.map((membership) => membership.user_id),
        ...paymentRows.flatMap((payment) => [
          payment.recorded_by,
          payment.voided_by,
        ]),
        ...submissionRows.map((submission) => submission.submitted_by),
        lifetimePaymentResult.data?.recorded_by,
        lifetimePaymentResult.data?.voided_by,
      ].filter((id): id is string => Boolean(id)),
    ),
  ]
  let profiles: Array<{
    email: string | null
    full_name: string | null
    id: string
  }> = []

  if (profileIds.length > 0) {
    const profilesResult = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)

    if (profilesResult.error) {
      return dataQueryError()
    }

    profiles = profilesResult.data ?? []
  }

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  )
  const primaryOwner = selectPrimaryOwner(ownerMemberships, profilesById)
  const plansById = new Map(
    (plansResult.data ?? []).map((plan) => [plan.id, plan]),
  )
  const plan = subscription
    ? plansById.get(subscription.plan_id)
    : undefined
  const planMonthlyPrices = Object.fromEntries(
    (plansResult.data ?? []).map((availablePlan) => [
      availablePlan.id,
      availablePlan.monthly_price === null
        ? null
        : Number(availablePlan.monthly_price),
    ]),
  )
  const planFounderMonthlyPrices = Object.fromEntries(
    (plansResult.data ?? []).map((availablePlan) => [
      availablePlan.id,
      availablePlan.founder_monthly_price === null
        ? null
        : Number(availablePlan.founder_monthly_price),
    ]),
  )
  const paymentHasNextPage = paymentRows.length > paymentLimit
  const visiblePayments = paymentRows.slice(0, paymentLimit)
  const lastPayment = visiblePayments.at(-1)
  const submissionHasNextPage = submissionRows.length > submissionLimit
  const visibleSubmissions = submissionRows.slice(0, submissionLimit)
  const lastSubmission = visibleSubmissions.at(-1)

  return jsonResponse({
    clinic: {
      activeMembersCount,
      blockedAt: subscription?.blocked_at ?? null,
      clinicId: clinicResult.data.id,
      clinicName: clinicResult.data.name,
      clinicStatus: resolveClinicStatus(
        clinicResult.data.status,
        subscription?.status,
      ),
      createdAt: clinicResult.data.created_at,
      currency: plan?.currency ?? 'BOB',
      currentPeriodEndsAt: subscription?.current_period_ends_at ?? null,
      customMonthlyPrice:
        subscription?.custom_monthly_price === null ||
          subscription?.custom_monthly_price === undefined
          ? null
          : Number(subscription.custom_monthly_price),
      founderMonthlyPrice:
        plan?.founder_monthly_price === null ||
          plan?.founder_monthly_price === undefined
          ? null
          : Number(plan.founder_monthly_price),
      founderPriceLocked: subscription?.founder_price_locked === true,
      graceEndsAt: subscription?.grace_ends_at ?? null,
      isLifetime: subscription?.is_lifetime === true,
      lastPaymentAt: subscription?.last_payment_at ?? null,
      latestRegisteredPaymentId:
        latestRegisteredPaymentResult.data?.id ?? null,
      monthlyPrice:
        plan?.monthly_price === null || plan?.monthly_price === undefined
          ? null
          : Number(plan.monthly_price),
      ownerEmail: primaryOwner?.email ?? null,
      ownerInvitationSentAt: primaryOwner?.invitationSentAt ?? null,
      ownerMembershipStatus: primaryOwner?.membershipStatus ?? null,
      ownerName: primaryOwner?.fullName ?? null,
      paymentStatus: subscription?.payment_status ?? null,
      payments: visiblePayments.map((payment) =>
        mapPayment(payment, profilesById)
      ),
      paymentSubmissions: visibleSubmissions.map((submission) =>
        mapSubmission(submission, profilesById)
      ),
      pendingPaymentSubmissionsCount: submissionsCountResult.count ?? 0,
      planFounderMonthlyPrices,
      planId: subscription?.plan_id ?? null,
      planMonthlyPrices,
      planName: plan?.name ?? null,
      priceTier: subscription?.price_tier ?? 'standard',
      registeredLifetimePayment: lifetimePaymentResult.data
        ? mapPayment(lifetimePaymentResult.data, profilesById)
        : null,
      scheduledPlanId: subscription?.scheduled_plan_id ?? null,
      scheduledPlanStartsAt:
        subscription?.scheduled_plan_starts_at ?? null,
      subscriptionStatus: normalizeSubscriptionStatus(subscription?.status),
      trialEndsAt: subscription?.trial_ends_at ?? null,
    },
    paymentPageInfo: {
      hasNextPage: paymentHasNextPage,
      limit: paymentLimit,
      nextCursor:
        paymentHasNextPage && lastPayment
          ? {
              createdAt: lastPayment.created_at,
              id: lastPayment.id,
              paidAt: lastPayment.paid_at,
            }
          : null,
      totalCount: paymentsCountResult.count ?? 0,
    },
    submissionPageInfo: {
      hasNextPage: submissionHasNextPage,
      limit: submissionLimit,
      nextCursor:
        submissionHasNextPage && lastSubmission
          ? {
              createdAt: lastSubmission.created_at,
              id: lastSubmission.id,
            }
          : null,
      totalCount: submissionsCountResult.count ?? 0,
    },
  })
}

function mapPayment(
  payment: Record<string, unknown>,
  profilesById: Map<
    string,
    { email: string | null; full_name: string | null; id: string }
  >,
) {
  const recordedById =
    typeof payment.recorded_by === 'string' ? payment.recorded_by : null
  const voidedById =
    typeof payment.voided_by === 'string' ? payment.voided_by : null
  const recorder = recordedById ? profilesById.get(recordedById) : null
  const voider = voidedById ? profilesById.get(voidedById) : null

  return {
    amountDue: Number(payment.amount_due),
    amountPaid: Number(payment.amount_paid),
    billingCycle: payment.billing_cycle,
    createdAt: payment.created_at,
    currency: payment.currency,
    customDays: payment.custom_days,
    discountAmount: Number(payment.discount_amount),
    discountPercent: Number(payment.discount_percent),
    id: payment.id,
    monthsCovered: payment.months_covered,
    newPlanId: payment.new_plan_id,
    notes: payment.notes,
    paidAt: payment.paid_at,
    paymentType: payment.payment_type,
    periodEndsAt: payment.period_ends_at,
    periodStartsAt: payment.period_starts_at,
    planId: payment.plan_id,
    previousPlanId: payment.previous_plan_id,
    priceTier: payment.price_tier,
    recordedBy: recorder?.full_name ?? recorder?.email ?? null,
    reference: payment.reference,
    status: payment.status,
    voidReason: payment.void_reason,
    voidedAt: payment.voided_at,
    voidedBy: voider?.full_name ?? voider?.email ?? null,
  }
}

function mapSubmission(
  submission: Record<string, unknown>,
  profilesById: Map<
    string,
    { email: string | null; full_name: string | null; id: string }
  >,
) {
  const submitterId =
    typeof submission.submitted_by === 'string'
      ? submission.submitted_by
      : null
  const submitter = submitterId ? profilesById.get(submitterId) : null

  return {
    amountExpected: Number(submission.amount_expected),
    billingCycle: submission.billing_cycle,
    createdAt: submission.created_at,
    currency: submission.currency,
    effectiveAt: submission.effective_at,
    id: submission.id,
    notes: submission.notes,
    paymentType: submission.payment_type,
    planId: submission.plan_id,
    previousPlanId: submission.previous_plan_id,
    reference: submission.reference,
    status: submission.status,
    submittedBy: submitter?.full_name ?? submitter?.email ?? null,
  }
}

async function parseInput(
  request: Request,
): Promise<
  | {
      input: {
        clinicId: string
        paymentCursor: PaymentCursor | null
        paymentLimit: number
        submissionCursor: SubmissionCursor | null
        submissionLimit: number
      }
    }
  | { error: PublicError }
> {
  let body: BillingInput

  try {
    body = await request.json() as BillingInput
  } catch {
    return invalidInput()
  }

  const paymentLimit = body.paymentLimit ?? DEFAULT_HISTORY_PAGE_SIZE
  const submissionLimit =
    body.submissionLimit ?? DEFAULT_HISTORY_PAGE_SIZE

  if (
    typeof body.clinicId !== 'string' ||
    !uuidPattern.test(body.clinicId) ||
    !isValidLimit(paymentLimit) ||
    !isValidLimit(submissionLimit) ||
    !isValidPaymentCursor(body.paymentCursor) ||
    !isValidSubmissionCursor(body.submissionCursor)
  ) {
    return invalidInput()
  }

  return {
    input: {
      clinicId: body.clinicId,
      paymentCursor: normalizePaymentCursor(body.paymentCursor),
      paymentLimit,
      submissionCursor: normalizeSubmissionCursor(body.submissionCursor),
      submissionLimit,
    },
  }
}

function isValidLimit(value: number) {
  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_HISTORY_PAGE_SIZE
  )
}

function isValidPaymentCursor(
  cursor: BillingInput['paymentCursor'],
) {
  return (
    cursor === undefined ||
    cursor === null ||
    (
      typeof cursor === 'object' &&
      typeof cursor.createdAt === 'string' &&
      Number.isFinite(Date.parse(cursor.createdAt)) &&
      typeof cursor.paidAt === 'string' &&
      Number.isFinite(Date.parse(cursor.paidAt)) &&
      typeof cursor.id === 'string' &&
      uuidPattern.test(cursor.id)
    )
  )
}

function isValidSubmissionCursor(
  cursor: BillingInput['submissionCursor'],
) {
  return (
    cursor === undefined ||
    cursor === null ||
    (
      typeof cursor === 'object' &&
      typeof cursor.createdAt === 'string' &&
      Number.isFinite(Date.parse(cursor.createdAt)) &&
      typeof cursor.id === 'string' &&
      uuidPattern.test(cursor.id)
    )
  )
}

function normalizePaymentCursor(
  cursor: BillingInput['paymentCursor'],
): PaymentCursor | null {
  return cursor
    ? {
        createdAt: new Date(cursor.createdAt).toISOString(),
        id: cursor.id,
        paidAt: new Date(cursor.paidAt).toISOString(),
      }
    : null
}

function normalizeSubmissionCursor(
  cursor: BillingInput['submissionCursor'],
): SubmissionCursor | null {
  return cursor
    ? {
        createdAt: new Date(cursor.createdAt).toISOString(),
        id: cursor.id,
      }
    : null
}

function buildPaymentCursorFilter(cursor: PaymentCursor) {
  return [
    `paid_at.lt.${cursor.paidAt}`,
    `and(paid_at.eq.${cursor.paidAt},created_at.lt.${cursor.createdAt})`,
    `and(paid_at.eq.${cursor.paidAt},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  ].join(',')
}

function buildSubmissionCursorFilter(cursor: SubmissionCursor) {
  return [
    `created_at.lt.${cursor.createdAt}`,
    `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  ].join(',')
}

function invalidInput() {
  return {
    error: {
      code: 'INVALID_PAYLOAD',
      message: 'La página comercial solicitada no es válida.',
    },
  } as const
}

function getSupabaseClientConfig():
  | { config: SupabaseClientConfig }
  | { error: PublicError } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: {
        code: 'SERVER_CONFIGURATION_ERROR',
        message: 'Supabase admin environment is not configured.',
      },
    }
  }

  return {
    config: { anonKey, serviceRoleKey, supabaseUrl },
  }
}

function dataQueryError() {
  return errorResponse(
    {
      code: 'DATA_QUERY_FAILED',
      message: 'No pudimos cargar la gestión del consultorio.',
    },
    500,
  )
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(error: PublicError, status: number) {
  return jsonResponse({ error: error.message, ...error }, status)
}
