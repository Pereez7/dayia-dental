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
    return await handleListPlatformClinics(request)
  } catch {
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos cargar los consultorios.',
      },
      500,
    )
  }
})

async function handleListPlatformClinics(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
      405,
    )
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
    return errorResponse(
      {
        code: 'PROFILE_QUERY_FAILED',
        message: 'No pudimos validar el acceso de plataforma.',
      },
      500,
    )
  }

  if (requesterProfile?.is_platform_admin !== true) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para ver los consultorios.',
      },
      403,
    )
  }

  const { data: clinics, error: clinicsError } = await adminClient
    .from('clinics')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })

  if (clinicsError) {
    return dataQueryError()
  }

  if (!clinics?.length) {
    return jsonResponse({ clinics: [] })
  }

  const clinicIds = clinics.map((clinic) => clinic.id)
  const scheduledPlanResults = await Promise.all(
    clinicIds.map((clinicId) =>
      adminClient.rpc('apply_due_scheduled_plan', {
        target_clinic_id: clinicId,
      }),
    ),
  )
  if (scheduledPlanResults.some((result) => result.error)) {
    return dataQueryError()
  }
  const [subscriptionsResult, membershipsResult, plansResult, paymentsResult] =
    await Promise.all([
      adminClient
        .from('clinic_subscriptions')
        .select('clinic_id, plan_id, status, trial_ends_at, current_period_ends_at, grace_ends_at, last_payment_at, payment_status, is_lifetime, price_tier, custom_monthly_price, founder_price_locked, scheduled_plan_id, scheduled_plan_starts_at')
        .in('clinic_id', clinicIds),
      adminClient
        .from('clinic_memberships')
        .select('clinic_id, user_id, role, status, activated_at, created_at')
        .in('clinic_id', clinicIds)
        .eq('status', 'active')
        .order('activated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      adminClient.from('plans').select('id, name, monthly_price, founder_monthly_price, currency'),
      adminClient
        .from('subscription_payments')
        .select('id, clinic_id, plan_id, billing_cycle, amount_paid, currency, discount_percent, reference, paid_at, recorded_by, payment_type, price_tier, previous_plan_id, new_plan_id')
        .in('clinic_id', clinicIds)
        .order('paid_at', { ascending: false }),
    ])

  if (
    subscriptionsResult.error ||
    membershipsResult.error ||
    plansResult.error ||
    paymentsResult.error
  ) {
    return dataQueryError()
  }

  const activeMemberships = membershipsResult.data ?? []
  const ownerMemberships = activeMemberships.filter(
    (membership) => membership.role === 'clinic_owner',
  )
  const ownerIds = [...new Set(ownerMemberships.map((owner) => owner.user_id))]
  const recorderIds = (paymentsResult.data ?? [])
    .map((payment) => payment.recorded_by)
    .filter((id): id is string => Boolean(id))
  const profileIds = [...new Set([...ownerIds, ...recorderIds])]
  let ownerProfiles: Array<{
    email: string | null
    full_name: string | null
    id: string
  }> = []

  if (profileIds.length > 0) {
    const ownerProfilesResult = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)

    if (ownerProfilesResult.error) {
      return dataQueryError()
    }

    ownerProfiles = ownerProfilesResult.data ?? []
  }

  const subscriptionsByClinic = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [
      subscription.clinic_id,
      subscription,
    ]),
  )
  const plansById = new Map(
    (plansResult.data ?? []).map((plan) => [plan.id, plan]),
  )
  const planMonthlyPrices = Object.fromEntries(
    (plansResult.data ?? []).map((plan) => [
      plan.id,
      plan.monthly_price === null ? null : Number(plan.monthly_price),
    ]),
  )
  const planFounderMonthlyPrices = Object.fromEntries(
    (plansResult.data ?? []).map((plan) => [
      plan.id,
      plan.founder_monthly_price === null ? null : Number(plan.founder_monthly_price),
    ]),
  )
  const ownerProfilesById = new Map(
    ownerProfiles.map((profile) => [profile.id, profile]),
  )
  const paymentsByClinic = new Map<
    string,
    NonNullable<typeof paymentsResult.data>
  >()
  const activeMembersCountByClinic = new Map<string, number>()
  const ownerMembershipsByClinic = new Map<
    string,
    typeof ownerMemberships
  >()

  for (const membership of activeMemberships) {
    activeMembersCountByClinic.set(
      membership.clinic_id,
      (activeMembersCountByClinic.get(membership.clinic_id) ?? 0) + 1,
    )
  }

  for (const membership of ownerMemberships) {
    const clinicOwners = ownerMembershipsByClinic.get(membership.clinic_id) ?? []
    clinicOwners.push(membership)
    ownerMembershipsByClinic.set(membership.clinic_id, clinicOwners)
  }

  for (const payment of paymentsResult.data ?? []) {
    const clinicPayments = paymentsByClinic.get(payment.clinic_id) ?? []
    clinicPayments.push(payment)
    paymentsByClinic.set(payment.clinic_id, clinicPayments)
  }

  return jsonResponse({
    clinics: clinics.map((clinic) => {
      const subscription = subscriptionsByClinic.get(clinic.id)
      const plan = subscription
        ? plansById.get(subscription.plan_id)
        : undefined
      const primaryOwner = selectPrimaryOwner(
        ownerMembershipsByClinic.get(clinic.id) ?? [],
        ownerProfilesById,
      )

      return {
        activeMembersCount: activeMembersCountByClinic.get(clinic.id) ?? 0,
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicStatus: resolveClinicStatus(
          clinic.status,
          subscription?.status,
        ),
        createdAt: clinic.created_at,
        ownerEmail: primaryOwner?.email ?? null,
        ownerName: primaryOwner?.fullName ?? null,
        planId: subscription?.plan_id ?? null,
        planName: plan?.name ?? null,
        monthlyPrice:
          plan?.monthly_price === null || plan?.monthly_price === undefined
            ? null
            : Number(plan.monthly_price),
        founderMonthlyPrice:
          plan?.founder_monthly_price === null || plan?.founder_monthly_price === undefined
            ? null
            : Number(plan.founder_monthly_price),
        planMonthlyPrices,
        planFounderMonthlyPrices,
        priceTier: subscription?.price_tier ?? 'standard',
        customMonthlyPrice: subscription?.custom_monthly_price === null || subscription?.custom_monthly_price === undefined
          ? null
          : Number(subscription.custom_monthly_price),
        founderPriceLocked: subscription?.founder_price_locked === true,
        scheduledPlanId: subscription?.scheduled_plan_id ?? null,
        scheduledPlanStartsAt: subscription?.scheduled_plan_starts_at ?? null,
        currency: plan?.currency ?? 'BOB',
        trialEndsAt: subscription?.trial_ends_at ?? null,
        currentPeriodEndsAt: subscription?.current_period_ends_at ?? null,
        graceEndsAt: subscription?.grace_ends_at ?? null,
        lastPaymentAt: subscription?.last_payment_at ?? null,
        paymentStatus: subscription?.payment_status ?? null,
        isLifetime: subscription?.is_lifetime === true,
        payments: (paymentsByClinic.get(clinic.id) ?? []).map((payment) => {
          const recorder = payment.recorded_by
            ? ownerProfilesById.get(payment.recorded_by)
            : null

          return {
            amountPaid: Number(payment.amount_paid),
            billingCycle: payment.billing_cycle,
            currency: payment.currency,
            discountPercent: Number(payment.discount_percent),
            id: payment.id,
            paidAt: payment.paid_at,
            planId: payment.plan_id,
            paymentType: payment.payment_type,
            priceTier: payment.price_tier,
            previousPlanId: payment.previous_plan_id,
            newPlanId: payment.new_plan_id,
            recordedBy: recorder?.full_name ?? recorder?.email ?? null,
            reference: payment.reference,
          }
        }),
        subscriptionStatus: normalizeSubscriptionStatus(subscription?.status),
      }
    }),
  })
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
      message: 'No pudimos cargar los consultorios.',
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
