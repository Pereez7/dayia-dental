import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Método no permitido.', 405)
  }

  const authorization = request.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!authorization || !token) {
    return errorResponse('UNAUTHORIZED', 'Tu sesión no es válida.', 401)
  }

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(
      'SERVER_CONFIGURATION_ERROR',
      'La anulación de pagos no está configurada.',
      500,
    )
  }

  const requester = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } =
    await requester.auth.getUser(token)

  if (userError || !userData.user) {
    return errorResponse('UNAUTHORIZED', 'Tu sesión no es válida.', 401)
  }

  const { data: profile, error: profileError } = await requester
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || profile?.is_platform_admin !== true) {
    return errorResponse(
      'FORBIDDEN',
      'No tienes permiso para anular pagos.',
      403,
    )
  }

  let payload: { paymentId?: unknown; reason?: unknown }

  try {
    payload = await request.json()
  } catch {
    return errorResponse('INVALID_PAYLOAD', 'Revisa los datos de anulación.', 400)
  }

  const paymentId =
    typeof payload.paymentId === 'string' ? payload.paymentId.trim() : ''
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''

  if (!uuidPattern.test(paymentId)) {
    return errorResponse('INVALID_PAYMENT', 'Selecciona un pago válido.', 400)
  }

  if (reason.length < 5 || reason.length > 500) {
    return errorResponse(
      'VOID_REASON_REQUIRED',
      'Explica el motivo de la anulación con al menos 5 caracteres.',
      400,
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.rpc('void_manual_subscription_payment', {
    target_payment_id: paymentId,
    target_void_reason: reason,
    target_voided_by: userData.user.id,
  })

  if (error) {
    if (error.message.includes('ONLY_LATEST_PAYMENT_CAN_BE_VOIDED')) {
      return errorResponse(
        'ONLY_LATEST_PAYMENT_CAN_BE_VOIDED',
        'Solo se puede anular el último pago vigente.',
        409,
      )
    }

    if (error.message.includes('PAYMENT_ALREADY_VOIDED')) {
      return errorResponse('PAYMENT_ALREADY_VOIDED', 'Este pago ya fue anulado.', 409)
    }

    if (error.message.includes('SUBSCRIPTION_CHANGED_AFTER_PAYMENT')) {
      return errorResponse(
        'SUBSCRIPTION_CHANGED_AFTER_PAYMENT',
        'La suscripción tuvo cambios posteriores que no se pueden restaurar automáticamente. Revisa el historial antes de anular.',
        409,
      )
    }

    if (error.message.includes('EXTRA_DAYS_CANNOT_BE_PRESERVED')) {
      return errorResponse(
        'EXTRA_DAYS_CANNOT_BE_PRESERVED',
        'No pudimos conservar los días adicionales con seguridad. Revisa las fechas de la suscripción.',
        409,
      )
    }

    return errorResponse(
      'VOID_PAYMENT_FAILED',
      'No pudimos anular el pago. Intenta nuevamente.',
      500,
    )
  }

  return jsonResponse({ paymentId: data, status: 'voided' })
})

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ code, message }, status)
}
