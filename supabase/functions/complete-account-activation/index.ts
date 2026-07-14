import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PublicError {
  code: string
  message: string
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
    return await handleCompleteAccountActivation(request)
  } catch {
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos completar la activación de tu cuenta.',
      },
      500,
    )
  }
})

async function handleCompleteAccountActivation(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' },
      405,
    )
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!authHeader || !token) {
    return unauthorizedResponse()
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !anonKey) {
    return configurationError()
  }

  const requesterClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } =
    await requesterClient.auth.getUser(token)

  if (userError || !userData.user) {
    return unauthorizedResponse()
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return configurationError()
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await adminClient.rpc(
    'complete_account_activation',
    { target_user_id: userData.user.id },
  )

  if (error || !isActivationResult(data)) {
    return errorResponse(
      {
        code: 'ACTIVATION_UPDATE_FAILED',
        message: 'No pudimos completar la activación de tu cuenta.',
      },
      500,
    )
  }

  return jsonResponse({ activation: data })
}

function isActivationResult(value: unknown): value is {
  clinicIds: string[]
  status: 'active'
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { clinicIds?: unknown; status?: unknown }
  return candidate.status === 'active' && Array.isArray(candidate.clinicIds)
}

function unauthorizedResponse() {
  return errorResponse(
    {
      code: 'UNAUTHORIZED',
      message: 'Tu sesión de activación no es válida. Solicita un nuevo enlace.',
    },
    401,
  )
}

function configurationError() {
  return errorResponse(
    {
      code: 'SERVER_CONFIGURATION_ERROR',
      message: 'La activación de cuentas no está configurada.',
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
