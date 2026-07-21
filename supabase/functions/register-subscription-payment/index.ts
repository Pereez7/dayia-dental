import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  calculatePaymentRegistration,
  calculateUpgradeProration,
  assertPlatformBillingAdmin,
  getEffectiveMonthlyPrice,
  getPlanChangeKind,
  normalizeRegisterPaymentPayload,
  SubscriptionBillingError,
} from '../_shared/subscriptionBilling.ts'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Método no permitido.', 405)

    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!authorization || !token) return unauthorized()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return configurationError()

    const requester = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData, error: userError } = await requester.auth.getUser(token)
    if (userError || !userData.user) return unauthorized()

    const { data: profile, error: profileError } = await requester
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profileError) return errorResponse('PROFILE_QUERY_FAILED', 'No pudimos validar el acceso de plataforma.', 500)
    assertPlatformBillingAdmin(profile?.is_platform_admin === true)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return configurationError()

    const input = normalizeRegisterPaymentPayload(await readJson(request))
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const [subscriptionResult, plansResult] = await Promise.all([
      admin
        .from('clinic_subscriptions')
        .select('id, plan_id, current_period_starts_at, current_period_ends_at, grace_ends_at, price_tier, custom_monthly_price')
        .eq('clinic_id', input.clinicId)
        .maybeSingle(),
      admin
        .from('plans')
        .select('id, monthly_price, founder_monthly_price')
        .in('id', [input.planId])
        .eq('is_active', true)
    ])

    if (subscriptionResult.error || !subscriptionResult.data) {
      return errorResponse('SUBSCRIPTION_NOT_FOUND', 'No encontramos la suscripción del consultorio.', 404)
    }
    if (plansResult.error || !plansResult.data?.length) {
      return errorResponse('INVALID_PLAN', 'El plan seleccionado no está disponible.', 400)
    }

    const subscription = subscriptionResult.data
    const targetPlan = plansResult.data.find((plan) => plan.id === input.planId)
    const { data: currentPlan, error: currentPlanError } = await admin
      .from('plans')
      .select('id, monthly_price, founder_monthly_price')
      .eq('id', subscription.plan_id)
      .maybeSingle()
    if (!targetPlan || currentPlanError || !currentPlan) {
      return errorResponse('INVALID_PLAN', 'No pudimos calcular el cambio de plan.', 400)
    }

    const priceTier = subscription.price_tier === 'founder' || subscription.price_tier === 'custom'
      ? subscription.price_tier
      : 'standard'
    const currentMonthlyPrice = getEffectiveMonthlyPrice({
      customPrice: subscription.custom_monthly_price === null ? null : Number(subscription.custom_monthly_price),
      founderPrice: currentPlan.founder_monthly_price === null ? null : Number(currentPlan.founder_monthly_price),
      priceTier,
      standardPrice: currentPlan.monthly_price === null ? null : Number(currentPlan.monthly_price),
    })
    const targetMonthlyPrice = getEffectiveMonthlyPrice({
      customPrice: subscription.custom_monthly_price === null ? null : Number(subscription.custom_monthly_price),
      founderPrice: targetPlan.founder_monthly_price === null ? null : Number(targetPlan.founder_monthly_price),
      priceTier,
      standardPrice: targetPlan.monthly_price === null ? null : Number(targetPlan.monthly_price),
    })

    const changeKind = getPlanChangeKind(subscription.plan_id, input.planId)
    if (input.paymentType === 'upgrade_proration' && changeKind !== 'upgrade') {
      return errorResponse('INVALID_UPGRADE', 'Selecciona un plan superior para registrar el upgrade.', 400)
    }
    if (input.paymentType !== 'upgrade_proration' && subscription.plan_id !== input.planId) {
      return errorResponse('PLAN_CHANGE_REQUIRES_ACTION', 'Gestiona el cambio de plan desde la sección correspondiente.', 409)
    }

    const isUpgrade = input.paymentType === 'upgrade_proration'
    const upgrade = calculateUpgradeProration({
      currentMonthlyPrice,
      currentPeriodEndsAt: subscription.current_period_ends_at,
      newMonthlyPrice: targetMonthlyPrice,
      now: new Date(input.paidAt),
    })
    const calculation = isUpgrade
      ? {
          amountDue: upgrade.amount,
          amountPaid: input.amountPaid,
          discountAmount: 0,
          graceEndsAt: subscription.grace_ends_at,
          periodEndsAt: subscription.current_period_ends_at,
          periodStartsAt: subscription.current_period_starts_at ?? input.paidAt,
        }
      : calculatePaymentRegistration({
          currentPeriodEndsAt: subscription.current_period_ends_at,
          input,
          monthlyPrice: targetMonthlyPrice,
          now: new Date(input.paidAt),
        })

    const { data: paymentId, error: paymentError } = await admin.rpc(
      'record_manual_subscription_payment',
      {
        target_amount_due: calculation.amountDue,
        target_amount_paid: calculation.amountPaid,
        target_billing_cycle: input.billingCycle,
        target_clinic_id: input.clinicId,
        target_custom_days: input.customDays,
        target_discount_amount: calculation.discountAmount,
        target_discount_percent: input.discountPercent,
        target_grace_ends_at: calculation.graceEndsAt,
        target_is_lifetime: input.isLifetime,
        target_months_covered: input.monthsCovered,
        target_notes: input.notes,
        target_paid_at: input.paidAt,
        target_period_ends_at: calculation.periodEndsAt,
        target_period_starts_at: calculation.periodStartsAt,
        target_plan_id: input.planId,
        target_payment_type: input.paymentType,
        target_previous_plan_id: subscription.plan_id,
        target_new_plan_id: input.planId,
        target_price_tier: priceTier,
        target_preserve_period: isUpgrade,
        target_recorded_by: userData.user.id,
        target_reference: input.reference,
      },
    )

    if (paymentError) throw paymentError

    return jsonResponse({
      paymentId,
      status: input.isLifetime ? 'lifetime' : 'active',
      ...calculation,
    }, 201)
  } catch (error) {
    if (error instanceof SubscriptionBillingError) {
      return errorResponse(error.code, error.message, error.status)
    }
    return errorResponse('REGISTER_PAYMENT_FAILED', 'No pudimos registrar el pago. Intenta nuevamente.', 500)
  }
})

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new SubscriptionBillingError('INVALID_PAYLOAD', 'Envía datos válidos para el pago.', 400)
  }
}

function unauthorized() {
  return errorResponse('UNAUTHORIZED', 'Tu sesión no es válida. Vuelve a iniciar sesión.', 401)
}

function configurationError() {
  return errorResponse('SERVER_CONFIGURATION_ERROR', 'El registro de pagos no está configurado.', 500)
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ code, error: message, message }, status)
}
