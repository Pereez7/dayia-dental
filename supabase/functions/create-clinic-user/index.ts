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

interface SupabaseClientConfig {
  anonKey: string
  serviceRoleKey: string
  supabaseUrl: string
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
        code: 'UNEXPECTED_ERROR',
        details: getDebugDetails(error instanceof Error ? error.message : undefined),
        message: 'Unexpected server error.',
      },
      500,
    )
  }
})

async function handleCreateClinicUser(request: Request) {
  console.log('create-clinic-user version', 'profile-query-debug-v2')

  if (request.method !== 'POST') {
    return errorResponse(
      {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.',
      },
      405,
    )
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  console.info('create-clinic-user authorization received', Boolean(authHeader))

  if (!authHeader || !token) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'No se encontró una sesión válida.',
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

  const configResult = getSupabaseClientConfig()

  if ('error' in configResult) {
    return errorResponse(configResult.error, 500)
  }

  const { anonKey, serviceRoleKey, supabaseUrl } = configResult.config
  console.log('create-clinic-user environment', {
    hasServiceRoleKey: Boolean(serviceRoleKey),
    supabaseHost: supabaseUrl ? new URL(supabaseUrl).host : null,
  })

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey)
  const supabaseRequester = createSupabaseRequesterClient(
    supabaseUrl,
    anonKey,
    authHeader,
  )
  const { data: requesterData, error: requesterError } =
    await supabaseRequester.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  const requesterUserId = requesterData.user.id
  console.info('create-clinic-user requester id', requesterUserId)
  console.log('create-clinic-user project check', {
    hasServiceRoleKey: Boolean(serviceRoleKey),
    requesterUserId,
    supabaseHost: new URL(supabaseUrl).host,
  })

  const { data: requesterProfile, error: requesterProfileError } =
    await supabaseAdmin
      .from('profiles')
      .select('id, clinic_id, email, role, is_active')
      .eq('id', requesterUserId)
      .maybeSingle()

  console.log('create-clinic-user profile query', {
    profileErrorCode: requesterProfileError?.code ?? null,
    profileErrorDetails: requesterProfileError?.details ?? null,
    profileErrorHint: requesterProfileError?.hint ?? null,
    profileErrorMessage: requesterProfileError?.message ?? null,
    profileFound: Boolean(requesterProfile),
  })

  console.log('create-clinic-user authorization', {
    hasClinicId: Boolean(requesterProfile?.clinic_id),
    profileFound: Boolean(requesterProfile),
    requesterRole: requesterProfile?.role ?? null,
    requesterUserId,
  })

  if (requesterProfileError) {
    console.log('create-clinic-user profile query failure', {
      errorCode: requesterProfileError.code ?? null,
      errorDetails: requesterProfileError.details ?? null,
      errorHint: requesterProfileError.hint ?? null,
      errorMessage: requesterProfileError.message ?? null,
      hasServiceRoleKey: Boolean(serviceRoleKey),
      requesterUserId,
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).host : null,
    })

    return errorResponse(
      {
        code: 'PROFILE_QUERY_FAILED',
        details: getDebugDetails(requesterProfileError.message),
        message: 'No pudimos validar el perfil del administrador.',
      },
      500,
    )
  }

  if (!requesterProfile) {
    return errorResponse(
      {
        code: 'PROFILE_NOT_FOUND',
        message: 'No encontramos el perfil del usuario solicitante.',
      },
      404,
    )
  }

  if (!requesterProfile.clinic_id) {
    return errorResponse(
      {
        code: 'CLINIC_NOT_LINKED',
        message: 'Tu perfil no está vinculado a un consultorio.',
      },
      403,
    )
  }

  if (
    requesterProfile.is_active === false ||
    !['clinic_admin', 'super_admin'].includes(requesterProfile.role)
  ) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para crear usuarios.',
      },
      403,
    )
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''
  const role = payload.role as AllowedClinicRole
  const clinicId = requesterProfile.clinic_id

  if (!requesterProfile.email && requesterData.user.email) {
    await supabaseAdmin
      .from('profiles')
      .update({
        email: requesterData.user.email.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requesterData.user.id)
  }

  const { data: existingProfile, error: existingProfileError } =
    await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

  if (existingProfileError) {
    return errorResponse(
      {
        code: 'PROFILE_LOOKUP_ERROR',
        details: getDebugDetails(existingProfileError.message),
        message: 'Could not validate email availability.',
      },
      400,
    )
  }

  if (existingProfile) {
    return errorResponse(
      {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists.',
      },
      409,
    )
  }

  // This creates the Auth user without asking for or showing a manual password.
  // A later phase should add the initial access flow through invite email or password recovery.
  const { data: createdUserData, error: authAdminError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

  if (authAdminError || !createdUserData.user?.id) {
    console.log('create-clinic-user auth admin failure', {
      authErrorCode: authAdminError?.code ?? null,
      authErrorMessage: authAdminError?.message ?? null,
      authErrorName: authAdminError?.name ?? null,
      authErrorStatus: authAdminError?.status ?? null,
      requestedEmail: email,
    })

    return errorResponse(
      {
        code: getAuthAdminErrorCode(authAdminError),
        details: getDebugDetails(authAdminError?.message),
        message: getAuthAdminErrorMessage(getAuthAdminErrorCode(authAdminError)),
      },
      getAuthAdminErrorCode(authAdminError) === 'EMAIL_ALREADY_EXISTS'
        ? 409
        : 400,
    )
  }

  const now = new Date().toISOString()
  const { data: createdProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      clinic_id: clinicId,
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
    console.log('create-clinic-user profile create failure', {
      createdAuthUserId: createdUserData.user.id,
      profileErrorCode: profileError?.code ?? null,
      profileErrorDetails: profileError?.details ?? null,
      profileErrorHint: profileError?.hint ?? null,
      profileErrorMessage: profileError?.message ?? null,
    })

    // Compensating action: remove only the Auth user created in this request
    // so a failed profile insert does not leave an orphan login account.
    await supabaseAdmin.auth.admin.deleteUser(createdUserData.user.id)
    return errorResponse(
      {
        code: 'PROFILE_CREATE_ERROR',
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
      code: 'INVALID_PAYLOAD',
      message: 'Full name is required.',
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      code: 'INVALID_PAYLOAD',
      message: 'Valid email is required.',
    }
  }

  if (!allowedRoles.includes(payload.role as AllowedClinicRole)) {
    return {
      code: 'INVALID_ROLE',
      message: 'Invalid role.',
    }
  }

  return null
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
    config: {
      anonKey,
      serviceRoleKey,
      supabaseUrl,
    },
  }
}

function createSupabaseAdminClient(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createSupabaseRequesterClient(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })
}

function getAuthAdminErrorCode(
  error: { code?: string; message?: string; name?: string; status?: number } | null,
) {
  const normalizedMessage = error?.message?.toLowerCase() ?? ''
  const normalizedCode = error?.code?.toLowerCase() ?? ''

  if (
    normalizedCode.includes('already') ||
    normalizedCode.includes('exists') ||
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('registered') ||
    normalizedMessage.includes('exists')
  ) {
    return 'EMAIL_ALREADY_EXISTS'
  }

  if (
    error?.status === 401 ||
    error?.status === 403 ||
    normalizedMessage.includes('not authorized') ||
    normalizedMessage.includes('permission') ||
    normalizedMessage.includes('service role')
  ) {
    return 'AUTH_ADMIN_PERMISSION_ERROR'
  }

  return 'AUTH_ADMIN_ERROR'
}

function getAuthAdminErrorMessage(code: string) {
  if (code === 'EMAIL_ALREADY_EXISTS') {
    return 'Este correo ya está registrado.'
  }

  if (code === 'AUTH_ADMIN_PERMISSION_ERROR') {
    return 'No fue posible crear el acceso del nuevo usuario.'
  }

  return 'No pudimos crear el acceso del nuevo usuario.'
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
