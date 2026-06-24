import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ownerUserId = '87f2b938-f6ea-4564-a3f3-8e7233fc6184'
const targetEmail = 'pereezcharles@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-owner-migration-token',
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
    return await handleMigrateOwnerEmail(request)
  } catch (error) {
    console.log('migrate-owner-email unexpected error', {
      errorMessage: error instanceof Error ? error.message : null,
      errorName: error instanceof Error ? error.name : null,
    })

    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos actualizar el correo de acceso.',
      },
      500,
    )
  }
})

async function handleMigrateOwnerEmail(request: Request) {
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
  const migrationTokenHeader = request.headers.get('x-owner-migration-token')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const migrationToken = Deno.env.get('OWNER_EMAIL_MIGRATION_TOKEN')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !migrationToken) {
    return errorResponse(
      {
        code: 'SERVER_CONFIGURATION_ERROR',
        message: 'La migración temporal de correo no está configurada.',
      },
      500,
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const requesterUserId = await resolveRequesterUserId({
    anonKey,
    authHeader,
    migrationToken,
    migrationTokenHeader,
    supabaseUrl,
    token,
  })

  if ('error' in requesterUserId) {
    return errorResponse(requesterUserId.error, requesterUserId.status)
  }

  const resolvedUserId = requesterUserId.userId

  if (resolvedUserId !== ownerUserId) {
    console.log('migrate-owner-email blocked non-owner user', {
      requesterUserId: resolvedUserId,
    })

    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'Esta migración temporal solo aplica al administrador principal.',
      },
      403,
    )
  }

  const { data: requesterProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, clinic_id, email, role, is_active')
    .eq('id', resolvedUserId)
    .maybeSingle()

  console.log('migrate-owner-email requester profile', {
    hasClinicId: Boolean(requesterProfile?.clinic_id),
    profileErrorCode: profileError?.code ?? null,
    profileErrorMessage: profileError?.message ?? null,
    profileFound: Boolean(requesterProfile),
    requesterRole: requesterProfile?.role ?? null,
    requesterUserId: resolvedUserId,
  })

  if (profileError) {
    return errorResponse(
      {
        code: 'PROFILE_QUERY_FAILED',
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

  if (
    requesterProfile.is_active === false ||
    !['clinic_admin', 'super_admin'].includes(requesterProfile.role)
  ) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para actualizar este correo.',
      },
      403,
    )
  }

  const { data: existingProfile, error: existingProfileError } =
    await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', targetEmail)
      .neq('id', resolvedUserId)
      .maybeSingle()

  if (existingProfileError) {
    return errorResponse(
      {
        code: 'PROFILE_QUERY_FAILED',
        message: 'No pudimos validar si el correo ya existe.',
      },
      500,
    )
  }

  if (existingProfile) {
    return errorResponse(
      {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Este correo ya está registrado.',
      },
      409,
    )
  }

  const { data: authUsersData, error: authUsersError } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

  if (authUsersError) {
    console.log('migrate-owner-email auth lookup failure', {
      authErrorCode: authUsersError.code ?? null,
      authErrorMessage: authUsersError.message ?? null,
      authErrorName: authUsersError.name ?? null,
      authErrorStatus: authUsersError.status ?? null,
      requesterUserId: resolvedUserId,
    })

    return errorResponse(
      {
        code: 'AUTH_LOOKUP_FAILED',
        message: 'No pudimos validar si el correo ya existe en Auth.',
      },
      500,
    )
  }

  const existingAuthUser = authUsersData.users.find(
    (authUser) =>
      authUser.email?.toLowerCase() === targetEmail &&
      authUser.id !== resolvedUserId,
  )

  if (existingAuthUser) {
    return errorResponse(
      {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Este correo ya está registrado.',
      },
      409,
    )
  }

  const { error: authUpdateError } =
    await supabaseAdmin.auth.admin.updateUserById(resolvedUserId, {
      email: targetEmail,
      email_confirm: true,
    })

  if (authUpdateError) {
    console.log('migrate-owner-email auth update failure', {
      authErrorCode: authUpdateError.code ?? null,
      authErrorMessage: authUpdateError.message ?? null,
      authErrorName: authUpdateError.name ?? null,
      authErrorStatus: authUpdateError.status ?? null,
      requesterUserId: resolvedUserId,
    })

    return errorResponse(
      {
        code: getAuthUpdateErrorCode(authUpdateError),
        message: getAuthUpdateErrorMessage(getAuthUpdateErrorCode(authUpdateError)),
      },
      getAuthUpdateErrorCode(authUpdateError) === 'EMAIL_ALREADY_EXISTS'
        ? 409
        : 400,
    )
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({
      email: targetEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resolvedUserId)

  if (profileUpdateError) {
    console.log('migrate-owner-email profile update failure', {
      profileErrorCode: profileUpdateError.code ?? null,
      profileErrorDetails: profileUpdateError.details ?? null,
      profileErrorHint: profileUpdateError.hint ?? null,
      profileErrorMessage: profileUpdateError.message ?? null,
      requesterUserId: resolvedUserId,
    })

    return errorResponse(
      {
        code: 'PROFILE_UPDATE_FAILED',
        message:
          'El correo de Auth se actualizó, pero no pudimos actualizar el perfil.',
      },
      500,
    )
  }

  return jsonResponse({
    email: targetEmail,
    message: 'Correo de acceso actualizado.',
  })
}

async function resolveRequesterUserId({
  anonKey,
  authHeader,
  migrationToken,
  migrationTokenHeader,
  supabaseUrl,
  token,
}: {
  anonKey: string
  authHeader?: string | null
  migrationToken: string
  migrationTokenHeader?: string | null
  supabaseUrl: string
  token?: string
}): Promise<
  | { userId: string }
  | { error: { code: string; message: string }; status: number }
> {
  if (migrationTokenHeader) {
    if (migrationTokenHeader !== migrationToken) {
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token temporal inválido.',
        },
        status: 401,
      }
    }

    console.log('migrate-owner-email using recovery token', {
      requesterUserId: ownerUserId,
    })

    return { userId: ownerUserId }
  }

  if (!authHeader || !token) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'No se encontró una sesión válida.',
      },
      status: 401,
    }
  }

  const supabaseRequester = createClient(supabaseUrl, anonKey, {
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
  const { data: requesterData, error: requesterError } =
    await supabaseRequester.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      },
      status: 401,
    }
  }

  return { userId: requesterData.user.id }
}

function getAuthUpdateErrorCode(
  error: { code?: string; message?: string; status?: number } | null,
) {
  const normalizedCode = error?.code?.toLowerCase() ?? ''
  const normalizedMessage = error?.message?.toLowerCase() ?? ''

  if (
    normalizedCode.includes('exists') ||
    normalizedCode.includes('already') ||
    normalizedMessage.includes('exists') ||
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('registered')
  ) {
    return 'EMAIL_ALREADY_EXISTS'
  }

  if (error?.status === 401 || error?.status === 403) {
    return 'AUTH_ADMIN_PERMISSION_ERROR'
  }

  return 'AUTH_UPDATE_FAILED'
}

function getAuthUpdateErrorMessage(code: string) {
  if (code === 'EMAIL_ALREADY_EXISTS') {
    return 'Este correo ya está registrado.'
  }

  if (code === 'AUTH_ADMIN_PERMISSION_ERROR') {
    return 'No fue posible actualizar el acceso del usuario.'
  }

  return 'No pudimos actualizar el correo de acceso.'
}

function errorResponse(body: { code: string; message: string }, status: number) {
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
