import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  getInvitationResendWaitSeconds,
  normalizeResendInvitationPayload,
  ResendPlatformClinicInvitationError,
} from '../_shared/resendPlatformClinicInvitation.ts'

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
    return await handleResendPlatformClinicInvitation(request)
  } catch (error) {
    if (error instanceof ResendPlatformClinicInvitationError) {
      return errorResponse(
        { code: error.code, message: error.message },
        error.status,
      )
    }

    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos reenviar la invitación. Intenta nuevamente.',
      },
      500,
    )
  }
})

async function handleResendPlatformClinicInvitation(request: Request) {
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
  const { data: requesterData, error: requesterError } =
    await requesterClient.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    return unauthorizedResponse()
  }

  // Authorization is resolved with the requester's JWT before service_role exists.
  const { data: requesterProfile, error: profileError } = await requesterClient
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
        message: 'No tienes permiso para reenviar invitaciones.',
      },
      403,
    )
  }

  const payload = normalizeResendInvitationPayload(await readJson(request))
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return configurationError()
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: membership, error: membershipError } = await adminClient
    .from('clinic_memberships')
    .select('id, user_id, invited_at')
    .eq('clinic_id', payload.clinicId)
    .eq('role', 'clinic_owner')
    .eq('status', 'pending_activation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membership) {
    return errorResponse(
      {
        code: 'PENDING_INVITATION_NOT_FOUND',
        message: 'Este consultorio no tiene una invitación pendiente.',
      },
      404,
    )
  }

  const [{ data: ownerProfile, error: ownerProfileError }, ownerAuthResult] =
    await Promise.all([
      adminClient
        .from('profiles')
        .select('email, full_name, invited_at, is_active')
        .eq('id', membership.user_id)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(membership.user_id),
    ])

  if (ownerProfileError || ownerAuthResult.error) {
    throw ownerProfileError ?? ownerAuthResult.error
  }

  const owner = ownerAuthResult.data.user

  if (!owner || !ownerProfile) {
    return errorResponse(
      {
        code: 'OWNER_NOT_FOUND',
        message: 'No encontramos la cuenta propietaria pendiente.',
      },
      404,
    )
  }

  if (owner.email_confirmed_at || owner.confirmed_at) {
    return errorResponse(
      {
        code: 'OWNER_ALREADY_ACTIVE',
        message: 'El propietario ya activó su cuenta. Actualiza el listado.',
      },
      409,
    )
  }

  if (ownerProfile.is_active === false) {
    return errorResponse(
      {
        code: 'OWNER_DISABLED',
        message: 'La cuenta propietaria está deshabilitada.',
      },
      409,
    )
  }

  const email =
    owner.email?.trim().toLowerCase() ??
    ownerProfile.email?.trim().toLowerCase() ??
    ''

  if (!email) {
    return errorResponse(
      {
        code: 'OWNER_EMAIL_MISSING',
        message: 'La cuenta propietaria no tiene un correo válido.',
      },
      409,
    )
  }

  const lastSentAt = getLatestTimestamp([
    membership.invited_at,
    ownerProfile.invited_at,
    owner.confirmation_sent_at,
  ])
  const waitSeconds = getInvitationResendWaitSeconds(lastSentAt)

  if (waitSeconds > 0) {
    return errorResponse(
      {
        code: 'INVITATION_RATE_LIMITED',
        message: `Espera ${waitSeconds} segundos antes de reenviar otra invitación.`,
      },
      429,
    )
  }

  const sentAt = new Date().toISOString()
  const { data: invitationData, error: invitationError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: ownerProfile.full_name?.trim() || undefined,
      },
      redirectTo: getActivationRedirectUrl(),
    })

  if (invitationError) {
    if (invitationError.status === 429) {
      return errorResponse(
        {
          code: 'INVITATION_RATE_LIMITED',
          message:
            'Supabase limitó temporalmente los correos. Intenta nuevamente en unos minutos.',
        },
        429,
      )
    }

    if (
      invitationError.status === 422 ||
      invitationError.message.toLowerCase().includes('already')
    ) {
      return errorResponse(
        {
          code: 'OWNER_ALREADY_ACTIVE',
          message:
            'La cuenta ya no admite una nueva invitación. Actualiza el listado.',
        },
        409,
      )
    }

    throw invitationError
  }

  if (!invitationData.user || invitationData.user.id !== membership.user_id) {
    throw new Error('Invitation user does not match the pending membership')
  }

  const trackingResults = await Promise.all([
    adminClient
      .from('clinic_memberships')
      .update({ invited_at: sentAt })
      .eq('id', membership.id)
      .eq('status', 'pending_activation'),
    adminClient
      .from('profiles')
      .update({ invited_at: sentAt, updated_at: sentAt })
      .eq('id', membership.user_id),
  ])

  if (trackingResults.some((result) => result.error)) {
    console.error('Invitation sent but tracking timestamp could not be updated')
  }

  return jsonResponse({ email, sentAt })
}

function getLatestTimestamp(values: Array<string | null | undefined>) {
  const validValues = values
    .map((value) => ({ timestamp: value ? Date.parse(value) : Number.NaN, value }))
    .filter(({ timestamp }) => !Number.isNaN(timestamp))
    .sort((left, right) => right.timestamp - left.timestamp)

  return validValues[0]?.value ?? null
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ResendPlatformClinicInvitationError(
      'INVALID_PAYLOAD',
      'No pudimos identificar el consultorio.',
      400,
    )
  }
}

function getActivationRedirectUrl() {
  const configuredAppUrl =
    Deno.env.get('DAYIA_APP_URL') ?? 'http://localhost:5173'

  return `${configuredAppUrl.replace(/\/+$/, '')}/activar-cuenta`
}

function unauthorizedResponse() {
  return errorResponse(
    {
      code: 'UNAUTHORIZED',
      message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
    },
    401,
  )
}

function configurationError() {
  return errorResponse(
    {
      code: 'SERVER_CONFIGURATION_ERROR',
      message: 'El reenvío de invitaciones no está configurado.',
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
