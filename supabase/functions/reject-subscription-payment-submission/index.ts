import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  normalizeRejectPaymentSubmissionPayload,
  PaymentSubmissionReviewError,
} from '../_shared/paymentSubmissionReview.ts'

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
        'La revisión de solicitudes no está configurada.',
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
        'No tienes permiso para rechazar solicitudes de pago.',
        403,
      )
    }

    const input = normalizeRejectPaymentSubmissionPayload(
      await readJson(request),
    )
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await admin.rpc(
      'reject_subscription_payment_submission',
      {
        target_reason: input.reason,
        target_reviewed_by: userData.user.id,
        target_submission_id: input.submissionId,
      },
    )

    if (error) {
      if (error.message.includes('PAYMENT_SUBMISSION_NOT_FOUND')) {
        return errorResponse(
          'PAYMENT_SUBMISSION_NOT_FOUND',
          'No encontramos la solicitud de pago.',
          404,
        )
      }

      if (error.message.includes('PAYMENT_SUBMISSION_NOT_PENDING')) {
        return errorResponse(
          'PAYMENT_SUBMISSION_NOT_PENDING',
          'Esta solicitud ya fue revisada.',
          409,
        )
      }

      return errorResponse(
        'REJECT_PAYMENT_SUBMISSION_FAILED',
        'No pudimos rechazar la solicitud. Intenta nuevamente.',
        500,
      )
    }

    return jsonResponse({ status: 'rejected', submissionId: data })
  } catch (error) {
    if (error instanceof PaymentSubmissionReviewError) {
      return errorResponse(error.code, error.message, error.status)
    }

    return errorResponse(
      'REJECT_PAYMENT_SUBMISSION_FAILED',
      'No pudimos rechazar la solicitud. Intenta nuevamente.',
      500,
    )
  }
})

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new PaymentSubmissionReviewError(
      'INVALID_PAYLOAD',
      'Envía datos válidos para revisar la solicitud.',
      400,
    )
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ code, message }, status)
}
