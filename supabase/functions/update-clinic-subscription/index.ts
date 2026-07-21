import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  assertPlatformBillingAdmin,
  calculateExtraDaysPeriod,
  getPlanChangeKind,
  getScheduledDowngradeUpdate,
  SubscriptionBillingError,
} from '../_shared/subscriptionBilling.ts'

type Action = 'change_plan' | 'force_change_plan' | 'grant_extra_days' | 'block' | 'reactivate' | 'mark_lifetime' | 'cancel' | 'set_founder_price' | 'set_custom_price' | 'set_standard_price'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (request.method !== 'POST') return responseError('METHOD_NOT_ALLOWED', 'Método no permitido.', 405)
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
    if (profileError) return responseError('PROFILE_QUERY_FAILED', 'No pudimos validar el acceso de plataforma.', 500)
    assertPlatformBillingAdmin(profile?.is_platform_admin === true)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return configurationError()
    const payload = await readPayload(request)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: subscription, error: readError } = await admin
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', payload.clinicId)
      .maybeSingle()
    if (readError || !subscription) {
      return responseError('SUBSCRIPTION_NOT_FOUND', 'No encontramos la suscripción del consultorio.', 404)
    }

    const now = new Date()
    const updates: Record<string, unknown> = { updated_at: now.toISOString() }

    let eventType = 'plan_changed'
    if (payload.action === 'change_plan') {
      if (!['basic', 'medium', 'pro'].includes(payload.planId)) return invalid('Selecciona un plan válido.')
      if (getPlanChangeKind(subscription.plan_id, payload.planId) !== 'downgrade') {
        return responseError('INVALID_DOWNGRADE', 'Los upgrades requieren registrar el pago prorrateado.', 409)
      }
      Object.assign(updates, getScheduledDowngradeUpdate(
        subscription.current_period_ends_at,
        payload.planId as 'basic' | 'medium' | 'pro',
      ))
      eventType = 'downgrade_scheduled'
    } else if (payload.action === 'force_change_plan') {
      if (!['basic', 'medium', 'pro'].includes(payload.planId)) return invalid('Selecciona un plan válido.')
      if (!payload.notes) return invalid('Explica el motivo del cambio inmediato.')
      updates.plan_id = payload.planId
      updates.scheduled_plan_id = null
      updates.scheduled_plan_starts_at = null
    } else if (payload.action === 'set_founder_price') {
      updates.price_tier = 'founder'
      updates.founder_price_locked = true
      updates.custom_monthly_price = null
      eventType = 'founder_enabled'
    } else if (payload.action === 'set_custom_price') {
      if (!Number.isFinite(payload.customMonthlyPrice) || payload.customMonthlyPrice < 0) {
        return invalid('Ingresa un precio personalizado válido.')
      }
      updates.price_tier = 'custom'
      updates.custom_monthly_price = payload.customMonthlyPrice
      updates.founder_price_locked = false
      eventType = 'custom_price_set'
    } else if (payload.action === 'set_standard_price') {
      updates.price_tier = 'standard'
      updates.custom_monthly_price = null
      updates.founder_price_locked = false
      eventType = subscription.price_tier === 'founder' ? 'founder_removed' : 'standard_price_restored'
    } else if (payload.action === 'grant_extra_days') {
      if (!Number.isInteger(payload.days) || payload.days < 1 || payload.days > 3650) {
        return invalid('Ingresa entre 1 y 3650 días adicionales.')
      }
      const period = calculateExtraDaysPeriod(
        subscription.current_period_ends_at,
        payload.days,
        now,
      )
      updates.current_period_starts_at = subscription.current_period_starts_at ?? now.toISOString()
      updates.current_period_ends_at = period.periodEndsAt
      updates.grace_ends_at = period.graceEndsAt
      updates.ends_at = period.periodEndsAt
      updates.status = 'active'
      updates.blocked_at = null
      updates.is_lifetime = false
      eventType = 'extra_days_granted'
    } else if (payload.action === 'block') {
      updates.status = 'blocked'
      updates.blocked_at = now.toISOString()
      eventType = 'blocked'
    } else if (payload.action === 'reactivate') {
      updates.status = 'active'
      updates.blocked_at = null
      const graceEnd = new Date(now.getTime() + 5 * 86_400_000)
      updates.grace_ends_at = graceEnd.toISOString()
      eventType = 'reactivated'
    } else if (payload.action === 'mark_lifetime') {
      updates.status = 'lifetime'
      updates.is_lifetime = true
      updates.current_period_ends_at = null
      updates.grace_ends_at = null
      updates.ends_at = null
      updates.blocked_at = null
      updates.billing_cycle = 'lifetime'
      updates.payment_status = 'paid'
      eventType = 'lifetime_enabled'
    } else {
      updates.status = 'cancelled'
      updates.payment_status = 'cancelled'
      eventType = 'cancelled'
    }

    const { error: updateError } = await admin
      .from('clinic_subscriptions')
      .update(updates)
      .eq('clinic_id', payload.clinicId)
    if (updateError) throw updateError

    const { error: eventError } = await admin.from('subscription_events').insert({
      clinic_id: payload.clinicId,
      subscription_id: subscription.id,
      event_type: eventType,
      previous_plan_id: subscription.plan_id,
      new_plan_id: payload.planId || subscription.plan_id,
      notes: payload.notes || null,
      metadata: {
        action: payload.action,
        custom_monthly_price: payload.action === 'set_custom_price' ? payload.customMonthlyPrice : null,
      },
      recorded_by: userData.user.id,
    })
    if (eventError) throw eventError

    return jsonResponse({ action: payload.action, clinicId: payload.clinicId, success: true })
  } catch (error) {
    if (error instanceof SubscriptionBillingError) {
      return responseError(error.code, error.message, error.status)
    }
    return responseError('UPDATE_SUBSCRIPTION_FAILED', 'No pudimos actualizar la suscripción.', 500)
  }
})

async function readPayload(request: Request) {
  let value: Record<string, unknown>

  try {
    value = await request.json() as Record<string, unknown>
  } catch {
    throw new SubscriptionBillingError(
      'INVALID_PAYLOAD',
      'Envía datos válidos para la suscripción.',
      400,
    )
  }
  const clinicId = typeof value.clinicId === 'string' ? value.clinicId.trim() : ''
  const action = typeof value.action === 'string' ? value.action.trim() as Action : '' as Action
  const allowed = new Set<Action>(['change_plan', 'force_change_plan', 'grant_extra_days', 'block', 'reactivate', 'mark_lifetime', 'cancel', 'set_founder_price', 'set_custom_price', 'set_standard_price'])
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(clinicId) || !allowed.has(action)) {
    throw new SubscriptionBillingError(
      'INVALID_PAYLOAD',
      'Revisa la acción administrativa.',
      400,
    )
  }
  return {
    action,
    clinicId,
    days: Number(value.days),
    customMonthlyPrice: Number(value.customMonthlyPrice),
    notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 1000) : '',
    planId: typeof value.planId === 'string' ? value.planId.trim().toLowerCase() : '',
  }
}

function invalid(message: string) {
  return responseError('INVALID_PAYLOAD', message, 400)
}
function unauthorized() {
  return responseError('UNAUTHORIZED', 'Tu sesión no es válida. Vuelve a iniciar sesión.', 401)
}
function configurationError() {
  return responseError('SERVER_CONFIGURATION_ERROR', 'La administración de suscripciones no está configurada.', 500)
}
function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })
}
function responseError(code: string, message: string, status: number) {
  return jsonResponse({ code, error: message, message }, status)
}
