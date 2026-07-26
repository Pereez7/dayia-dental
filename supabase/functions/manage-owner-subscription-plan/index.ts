import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  calculateTieredRenewalAmount,
  calculateUpgradeProration,
  getEffectiveMonthlyPrice,
  getPlanChangeKind,
  isFounderPricingEligible,
  isSubscriptionAccessBlocked,
  SubscriptionBillingError,
} from '../_shared/subscriptionBilling.ts'

type OwnerPlanAction =
  | 'cancel_scheduled_downgrade'
  | 'schedule_downgrade'
  | 'submit_payment_notice'

type BillingCycle = 'annual' | 'monthly' | 'six_months'

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const planIds = new Set(['basic', 'medium', 'pro'])
const billingCycles = new Set<BillingCycle>([
  'annual',
  'monthly',
  'six_months',
])
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (request.method !== 'POST') {
      return responseError(
        'METHOD_NOT_ALLOWED',
        'Método no permitido.',
        405,
      )
    }

    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!authorization || !token) return unauthorized()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return configurationError()
    }

    const requester = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData, error: userError } =
      await requester.auth.getUser(token)
    if (userError || !userData.user) return unauthorized()

    const input = await readPayload(request)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: membership, error: membershipError } = await admin
      .from('clinic_memberships')
      .select('id')
      .eq('clinic_id', input.clinicId)
      .eq('user_id', userData.user.id)
      .eq('role', 'clinic_owner')
      .eq('status', 'active')
      .maybeSingle()

    if (membershipError) {
      return responseError(
        'MEMBERSHIP_QUERY_FAILED',
        'No pudimos validar el consultorio.',
        500,
      )
    }
    if (!membership) {
      return responseError(
        'FORBIDDEN',
        'Solo el propietario puede gestionar el plan.',
        403,
      )
    }

    if (input.action === 'cancel_scheduled_downgrade') {
      const { data, error } = await admin.rpc(
        'cancel_scheduled_subscription_downgrade',
        {
          target_clinic_id: input.clinicId,
          target_recorded_by: userData.user.id,
        },
      )

      if (error) return mapRpcError(error.message)
      return jsonResponse({
        action: input.action,
        cancelledPlanId: data,
        success: true,
      })
    }

    const [{ data: subscription, error: subscriptionError }, plansResult] =
      await Promise.all([
        admin
          .from('clinic_subscriptions')
          .select(
            'id, plan_id, scheduled_plan_id, status, blocked_at, trial_ends_at, current_period_ends_at, grace_ends_at, is_lifetime, price_tier, custom_monthly_price',
          )
          .eq('clinic_id', input.clinicId)
          .maybeSingle(),
        admin
          .from('plans')
          .select(
            'id, name, currency, monthly_price, founder_monthly_price, is_active',
          )
          .in('id', [input.planId]),
      ])

    if (subscriptionError || !subscription) {
      return responseError(
        'SUBSCRIPTION_NOT_FOUND',
        'No encontramos la suscripción del consultorio.',
        404,
      )
    }
    if (subscription.is_lifetime || subscription.status === 'lifetime') {
      return responseError(
        'LIFETIME_MEMBERSHIP_ACTIVE',
        'La membresía vitalicia no requiere cambios de renovación.',
        409,
      )
    }
    if (subscription.status === 'cancelled') {
      return responseError(
        'SUBSCRIPTION_CANCELLED',
        'La suscripción cancelada requiere revisión administrativa.',
        409,
      )
    }
    if (
      subscription.scheduled_plan_id &&
      input.action === 'submit_payment_notice'
    ) {
      return responseError(
        'SCHEDULED_DOWNGRADE_ACTIVE',
        'Cancela primero el cambio programado antes de solicitar otro pago.',
        409,
      )
    }

    const targetPlan = plansResult.data?.find(
      (plan) => plan.id === input.planId && plan.is_active === true,
    )
    if (plansResult.error || !targetPlan) {
      return responseError(
        'INVALID_PLAN',
        'El plan seleccionado no está disponible.',
        400,
      )
    }

    const changeKind = getPlanChangeKind(
      subscription.plan_id,
      input.planId,
    )
    const isBlocked = isSubscriptionAccessBlocked({
      currentPeriodEndsAt: subscription.current_period_ends_at,
      graceEndsAt: subscription.grace_ends_at,
      status: subscription.status,
      trialEndsAt: subscription.trial_ends_at,
    })

    if (input.action === 'schedule_downgrade') {
      if (changeKind !== 'downgrade' || isBlocked) {
        return responseError(
          'INVALID_DOWNGRADE',
          'Solo puedes programar un plan inferior al finalizar una vigencia activa.',
          409,
        )
      }

      const { data, error } = await admin.rpc(
        'schedule_subscription_downgrade',
        {
          target_clinic_id: input.clinicId,
          target_plan_id: input.planId,
          target_recorded_by: userData.user.id,
        },
      )

      if (error) return mapRpcError(error.message)
      return jsonResponse({
        action: input.action,
        effectiveAt: data,
        planId: input.planId,
        success: true,
      })
    }

    if (changeKind === 'downgrade' && !isBlocked) {
      return responseError(
        'DOWNGRADE_REQUIRES_SCHEDULE',
        'Programa el downgrade para el final del periodo vigente.',
        409,
      )
    }

    const { data: currentPlan, error: currentPlanError } = await admin
      .from('plans')
      .select('id, monthly_price, founder_monthly_price')
      .eq('id', subscription.plan_id)
      .maybeSingle()
    if (currentPlanError || !currentPlan) {
      return responseError(
        'CURRENT_PLAN_NOT_FOUND',
        'No pudimos calcular el cambio de plan.',
        409,
      )
    }

    const now = new Date()
    const priceTier =
      subscription.price_tier === 'founder' ||
      subscription.price_tier === 'custom'
        ? subscription.price_tier
        : 'standard'
    const effectivePriceTier =
      priceTier === 'founder' &&
      !isFounderPricingEligible({
        blockedAt: subscription.blocked_at,
        paidAt: now,
      })
        ? 'standard'
        : priceTier
    const currentMonthlyPrice = getEffectiveMonthlyPrice({
      customPrice:
        subscription.custom_monthly_price === null
          ? null
          : Number(subscription.custom_monthly_price),
      founderPrice:
        currentPlan.founder_monthly_price === null
          ? null
          : Number(currentPlan.founder_monthly_price),
      priceTier: effectivePriceTier,
      standardPrice:
        currentPlan.monthly_price === null
          ? null
          : Number(currentPlan.monthly_price),
    })
    const targetMonthlyPrice = getEffectiveMonthlyPrice({
      customPrice:
        subscription.custom_monthly_price === null
          ? null
          : Number(subscription.custom_monthly_price),
      founderPrice:
        targetPlan.founder_monthly_price === null
          ? null
          : Number(targetPlan.founder_monthly_price),
      priceTier: effectivePriceTier,
      standardPrice:
        targetPlan.monthly_price === null
          ? null
          : Number(targetPlan.monthly_price),
    })

    let amountExpected: number
    let billingCycle = input.billingCycle
    let discountPercent = 0
    let paymentType:
      | 'regular'
      | 'reactivation_plan_change'
      | 'upgrade_proration'
    let effectiveAt: string | null

    if (changeKind === 'upgrade' && !isBlocked) {
      const proration = calculateUpgradeProration({
        currentMonthlyPrice,
        currentPeriodEndsAt: subscription.current_period_ends_at,
        newMonthlyPrice: targetMonthlyPrice,
        now,
      })
      if (proration.amount <= 0) {
        return responseError(
          'UPGRADE_NOT_BILLABLE',
          'No hay una diferencia pendiente para aplicar este upgrade.',
          409,
        )
      }
      amountExpected = proration.amount
      billingCycle = 'monthly'
      paymentType = 'upgrade_proration'
      effectiveAt = null
    } else {
      const renewal = calculateTieredRenewalAmount({
        billingCycle,
        effectiveMonthlyPrice: targetMonthlyPrice,
        priceTier: effectivePriceTier,
        standardMonthlyPrice:
          targetPlan.monthly_price === null
            ? null
            : Number(targetPlan.monthly_price),
      })
      if (renewal.amountPaid <= 0) {
        return responseError(
          'PLAN_PRICE_NOT_CONFIGURED',
          'El precio del plan seleccionado todavía no está configurado.',
          409,
        )
      }
      amountExpected = renewal.amountPaid
      discountPercent = renewal.discountPercent
      paymentType =
        isBlocked && changeKind !== 'same'
          ? 'reactivation_plan_change'
          : 'regular'
      effectiveAt =
        isBlocked
          ? now.toISOString()
          : subscription.current_period_ends_at
    }

    const { data: pendingSubmission, error: pendingError } = await admin
      .from('subscription_payment_submissions')
      .select('id, plan_id, amount_expected, payment_type')
      .eq('clinic_id', input.clinicId)
      .eq('status', 'pending_review')
      .limit(1)
      .maybeSingle()

    if (pendingError) {
      return responseError(
        'PAYMENT_NOTICE_QUERY_FAILED',
        'No pudimos revisar las solicitudes pendientes.',
        500,
      )
    }
    if (pendingSubmission) {
      return jsonResponse({
        action: input.action,
        alreadyPending: true,
        amountExpected: Number(pendingSubmission.amount_expected),
        id: pendingSubmission.id,
        paymentType: pendingSubmission.payment_type,
        planId: pendingSubmission.plan_id,
        success: true,
      })
    }

    const { data: submission, error: submissionError } = await admin
      .from('subscription_payment_submissions')
      .insert({
        amount_expected: amountExpected,
        billing_cycle: billingCycle,
        clinic_id: input.clinicId,
        currency: targetPlan.currency?.trim() || 'BOB',
        effective_at: effectiveAt,
        notes:
          paymentType === 'upgrade_proration'
            ? 'Comprobante de upgrade enviado por WhatsApp.'
            : paymentType === 'reactivation_plan_change'
              ? 'Comprobante para reactivar con un nuevo plan enviado por WhatsApp.'
              : 'Comprobante de renovación enviado por WhatsApp.',
        payment_type: paymentType,
        plan_id: input.planId,
        previous_plan_id: subscription.plan_id,
        reference: 'dayia-whatsapp',
        status: 'pending_review',
        submitted_by: userData.user.id,
      })
      .select('id')
      .single()

    if (submissionError || !submission) {
      if (submissionError?.code === '23505') {
        return jsonResponse({
          action: input.action,
          alreadyPending: true,
          success: true,
        })
      }
      return responseError(
        'PAYMENT_NOTICE_CREATE_FAILED',
        'No pudimos avisar a Administración DayIA.',
        500,
      )
    }

    return jsonResponse(
      {
        action: input.action,
        alreadyPending: false,
        amountExpected,
        discountPercent,
        effectiveAt,
        id: submission.id,
        paymentType,
        planId: input.planId,
        success: true,
      },
      201,
    )
  } catch (error) {
    if (error instanceof SubscriptionBillingError) {
      return responseError(error.code, error.message, error.status)
    }
    return responseError(
      'OWNER_PLAN_CHANGE_FAILED',
      'No pudimos gestionar el cambio de plan.',
      500,
    )
  }
})

async function readPayload(request: Request) {
  let value: Record<string, unknown>
  try {
    value = (await request.json()) as Record<string, unknown>
  } catch {
    throw invalid('Envía datos válidos para el cambio de plan.')
  }

  const action =
    typeof value.action === 'string'
      ? (value.action.trim() as OwnerPlanAction)
      : ('' as OwnerPlanAction)
  const clinicId =
    typeof value.clinicId === 'string' ? value.clinicId.trim() : ''
  const planId =
    typeof value.planId === 'string'
      ? value.planId.trim().toLowerCase()
      : ''
  const billingCycle =
    typeof value.billingCycle === 'string'
      ? (value.billingCycle.trim() as BillingCycle)
      : 'monthly'

  if (
    ![
      'cancel_scheduled_downgrade',
      'schedule_downgrade',
      'submit_payment_notice',
    ].includes(action) ||
    !uuidPattern.test(clinicId)
  ) {
    throw invalid('Revisa la solicitud de cambio de plan.')
  }
  if (
    action !== 'cancel_scheduled_downgrade' &&
    (!planIds.has(planId) || !billingCycles.has(billingCycle))
  ) {
    throw invalid('Selecciona un plan y un periodo válidos.')
  }

  return {
    action,
    billingCycle,
    clinicId,
    planId,
  }
}

function mapRpcError(message: string) {
  if (message.includes('FORBIDDEN')) {
    return responseError(
      'FORBIDDEN',
      'Solo el propietario puede gestionar el plan.',
      403,
    )
  }
  if (message.includes('NO_SCHEDULED_DOWNGRADE')) {
    return responseError(
      'NO_SCHEDULED_DOWNGRADE',
      'Ya no existe un downgrade programado.',
      409,
    )
  }
  if (
    message.includes('DOWNGRADE_ALREADY_SCHEDULED') ||
    message.includes('PAYMENT_NOTICE_PENDING')
  ) {
    return responseError(
      'PLAN_CHANGE_CONFLICT',
      'Resuelve primero el cambio o pago que ya está pendiente.',
      409,
    )
  }
  if (
    message.includes('INVALID_DOWNGRADE') ||
    message.includes('CURRENT_PERIOD_NOT_ACTIVE') ||
    message.includes('SUBSCRIPTION_NOT_SCHEDULABLE')
  ) {
    return responseError(
      'DOWNGRADE_NOT_AVAILABLE',
      'No puedes programar este downgrade en el estado actual.',
      409,
    )
  }

  return responseError(
    'PLAN_CHANGE_UPDATE_FAILED',
    'No pudimos actualizar el cambio programado.',
    500,
  )
}

function invalid(message: string) {
  return new SubscriptionBillingError('INVALID_PAYLOAD', message, 400)
}

function unauthorized() {
  return responseError(
    'UNAUTHORIZED',
    'Tu sesión no es válida. Vuelve a iniciar sesión.',
    401,
  )
}

function configurationError() {
  return responseError(
    'SERVER_CONFIGURATION_ERROR',
    'La gestión de planes no está configurada.',
    500,
  )
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

function responseError(code: string, message: string, status: number) {
  return jsonResponse({ code, error: message, message }, status)
}
