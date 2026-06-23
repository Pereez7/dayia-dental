import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AllowedClinicRole = 'clinic_admin' | 'doctor' | 'receptionist'

interface CreateClinicUserPayload {
  email?: string
  fullName?: string
  role?: string
}

interface PublicError {
  code: string
  details?: string
  message: string
}

const allowedRoles: AllowedClinicRole[] = [
  'clinic_admin',
  'doctor',
  'receptionist',
]

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    })
  }

  try {
    return await handleCreateClinicUser(request)
  } catch (error) {
    return errorResponse(
      {
        code: 'unexpected_error',
        details: getDebugDetails(error instanceof Error ? error.message : undefined),
        message: 'Unexpected server error.',
      },
      500,
    )
  }
})

async function handleCreateClinicUser(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      {
        code: 'method_not_allowed',
        message: 'Method not allowed.',
      },
      405,
    )
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return errorResponse(
      {
        code: 'unauthorized',
        message: 'Missing authorization token.',
      },
      401,
    )
  }

  const payload = await readPayload(request)
  const validationError = validatePayload(payload)

  if (validationError) {
    return errorResponse(
      {
        code: validationError.code,
        message: validationError.message,
      },
      400,
    )
  }

  const adminClientResult = createAdminClient()

  if ('error' in adminClientResult) {
    return errorResponse(adminClientResult.error, 500)
  }

  const supabase = adminClientResult.supabase
  const { data: callerData, error: callerError } =
    await supabase.auth.getUser(token)

  if (callerError || !callerData.user) {
    return errorResponse(
      {
        code: 'unauthorized',
        message: 'Invalid session.',
      },
      401,
    )
  }

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from('profiles')
    .select('id, clinic_id, email, role')
    .eq('id', callerData.user.id)
    .maybeSingle()

  if (callerProfileError || !callerProfile?.clinic_id) {
    return errorResponse(
      {
        code: 'forbidden',
        message: 'Caller profile is not linked to a clinic.',
      },
      403,
    )
  }

  if (!['clinic_admin', 'super_admin'].includes(callerProfile.role)) {
    return errorResponse(
      {
        code: 'forbidden',
        message: 'Only clinic admins can create users.',
      },
      403,
    )
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''
  const role = payload.role as AllowedClinicRole

  if (!callerProfile.email && callerData.user.email) {
    await supabase
      .from('profiles')
      .update({
        email: callerData.user.email.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callerData.user.id)
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfileError) {
    return errorResponse(
      {
        code: 'profile_lookup_error',
        details: getDebugDetails(existingProfileError.message),
        message: 'Could not validate email availability.',
      },
      400,
    )
  }

  if (existingProfile) {
    return errorResponse(
      {
        code: 'email_exists',
        message: 'A user with this email already exists.',
      },
      409,
    )
  }

  const { data: createdUserData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        clinic_id: callerProfile.clinic_id,
        full_name: fullName,
        role,
      },
    })

  if (inviteError || !createdUserData.user) {
    return errorResponse(
      {
        code: getInviteErrorCode(inviteError?.message),
        details: getDebugDetails(inviteError?.message),
        message: 'Could not create auth user.',
      },
      getInviteErrorCode(inviteError?.message) === 'email_exists' ? 409 : 400,
    )
  }

  const now = new Date().toISOString()
  const { data: createdProfile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      clinic_id: callerProfile.clinic_id,
      created_at: now,
      email,
      full_name: fullName,
      id: createdUserData.user.id,
      is_active: true,
      role,
      updated_at: now,
    })
    .select('id, clinic_id, full_name, email, role, is_active, created_at')
    .single()

  if (profileError || !createdProfile) {
    await supabase.auth.admin.deleteUser(createdUserData.user.id)
    return errorResponse(
      {
        code: 'profile_create_error',
        details: getDebugDetails(profileError?.message),
        message: 'Could not create clinic profile.',
      },
      400,
    )
  }

  return jsonResponse({
    user: {
      clinicId: createdProfile.clinic_id,
      createdAt: createdProfile.created_at,
      email: createdProfile.email,
      fullName: createdProfile.full_name,
      id: createdProfile.id,
      isActive: createdProfile.is_active,
      role: createdProfile.role,
    },
  })
}

async function readPayload(request: Request): Promise<CreateClinicUserPayload> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function validatePayload(payload: CreateClinicUserPayload) {
  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''

  if (!fullName || fullName.length < 3) {
    return {
      code: 'invalid_payload',
      message: 'Full name is required.',
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      code: 'invalid_payload',
      message: 'Valid email is required.',
    }
  }

  if (!allowedRoles.includes(payload.role as AllowedClinicRole)) {
    return {
      code: 'invalid_role',
      message: 'Invalid role.',
    }
  }

  return null
}

function createAdminClient():
  | { supabase: ReturnType<typeof createClient> }
  | { error: PublicError } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: {
        code: 'server_not_configured',
        message: 'Supabase admin environment is not configured.',
      },
    }
  }

  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  }
}

function getInviteErrorCode(message = '') {
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('registered') ||
    normalizedMessage.includes('exists')
  ) {
    return 'email_exists'
  }

  return 'auth_admin_error'
}

function getDebugDetails(details: string | undefined) {
  return Deno.env.get('DAYIA_FUNCTION_DEBUG') === 'true' ? details : undefined
}

function errorResponse(body: PublicError, status: number) {
  return jsonResponse(body, status)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
