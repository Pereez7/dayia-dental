import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { lookupAuthUserByEmail } from '../_shared/authUserLookup.ts'
import {
  CorrectPlatformClinicOwnerEmailError,
  isRegisteredAuthEmailError,
  normalizeCorrectPlatformClinicOwnerEmailPayload,
} from '../_shared/correctPlatformClinicOwnerEmail.ts'

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
    return await handleCorrectPlatformClinicOwnerEmail(request)
  } catch (error) {
    if (error instanceof CorrectPlatformClinicOwnerEmailError) {
      return errorResponse(
        { code: error.code, message: error.message },
        error.status,
      )
    }

    console.error('correct-platform-clinic-owner-email failed', {
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message:
          'No pudimos corregir el correo del propietario. Intenta nuevamente.',
      },
      500,
    )
  }
})

async function handleCorrectPlatformClinicOwnerEmail(request: Request) {
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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

  const { data: requesterProfile, error: requesterProfileError } =
    await requesterClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', requesterData.user.id)
      .maybeSingle()

  if (requesterProfileError) {
    throw requesterProfileError
  }

  if (requesterProfile?.is_platform_admin !== true) {
    return errorResponse(
      {
        code: 'FORBIDDEN',
        message: 'No tienes permiso para corregir propietarios.',
      },
      403,
    )
  }

  const payload = normalizeCorrectPlatformClinicOwnerEmailPayload(
    await readJson(request),
  )
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
  const [
    { data: clinic, error: clinicError },
    { data: ownerMemberships, error: membershipError },
  ] = await Promise.all([
    adminClient
      .from('clinics')
      .select('id, status')
      .eq('id', payload.clinicId)
      .maybeSingle(),
    adminClient
      .from('clinic_memberships')
      .select('id, user_id, status, created_at')
      .eq('clinic_id', payload.clinicId)
      .eq('role', 'clinic_owner')
      .in('status', ['active', 'pending_activation'])
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (clinicError || membershipError) {
    throw clinicError ?? membershipError
  }

  if (!clinic) {
    return errorResponse(
      { code: 'CLINIC_NOT_FOUND', message: 'No encontramos el consultorio.' },
      404,
    )
  }

  if (clinic.status !== 'pending_activation') {
    return errorResponse(
      {
        code: 'CLINIC_NOT_PENDING',
        message:
          'El correo del propietario solo puede corregirse antes de activar el consultorio.',
      },
      409,
    )
  }

  const ownerMembership = ownerMemberships?.[0]

  if (!ownerMembership) {
    return errorResponse(
      {
        code: 'OWNER_MEMBERSHIP_NOT_FOUND',
        message: 'No encontramos al propietario actual del consultorio.',
      },
      404,
    )
  }

  const [{ data: ownerProfile, error: ownerProfileError }, ownerAuthResult] =
    await Promise.all([
      adminClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerMembership.user_id)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(ownerMembership.user_id),
    ])

  if (ownerProfileError || ownerAuthResult.error) {
    throw ownerProfileError ?? ownerAuthResult.error
  }

  const currentOwner = ownerAuthResult.data.user

  if (!currentOwner || !ownerProfile) {
    return errorResponse(
      {
        code: 'OWNER_NOT_FOUND',
        message: 'No encontramos la cuenta propietaria actual.',
      },
      404,
    )
  }

  const currentEmail =
    currentOwner.email?.trim().toLowerCase() ??
    ownerProfile.email?.trim().toLowerCase() ??
    ''

  if (currentEmail === payload.ownerEmail) {
    return errorResponse(
      {
        code: 'OWNER_EMAIL_UNCHANGED',
        message: 'Ingresa un correo diferente al actual.',
      },
      409,
    )
  }

  const { data: existingProfiles, error: existingProfileError } =
    await adminClient
      .from('profiles')
      .select('id')
      .eq('email', payload.ownerEmail)
      .limit(1)

  if (existingProfileError) {
    throw existingProfileError
  }

  if ((existingProfiles?.length ?? 0) > 0) {
    return registeredEmailResponse()
  }

  const existingAuthUser = await lookupAuthUserByEmail(
    adminClient,
    payload.ownerEmail,
  )

  if (existingAuthUser) {
    return registeredEmailResponse()
  }

  const sentAt = new Date().toISOString()
  const { data: invitationData, error: invitationError } =
    await adminClient.auth.admin.inviteUserByEmail(payload.ownerEmail, {
      data: {
        full_name: ownerProfile.full_name?.trim() || undefined,
      },
      redirectTo: getActivationRedirectUrl(),
    })

  if (invitationError || !invitationData.user) {
    if (invitationError?.status === 429) {
      return errorResponse(
        {
          code: 'INVITATION_RATE_LIMITED',
          message:
            'Supabase limitó temporalmente los correos. Intenta nuevamente en unos minutos.',
        },
        429,
      )
    }

    if (isRegisteredAuthEmailError(invitationError)) {
      return registeredEmailResponse()
    }

    throw invitationError ?? new Error('Replacement owner was not invited')
  }

  const replacementUser = invitationData.user
  let replacementState: 'committed' | 'uncommitted' | 'unknown' =
    'uncommitted'

  try {
    await upsertReplacementProfile(
      adminClient,
      replacementUser.id,
      payload.clinicId,
      payload.ownerEmail,
      ownerProfile.full_name,
      sentAt,
    )

    replacementState = 'unknown'
    const { error: replacementError } =
      await adminClient.rpc('replace_pending_platform_clinic_owner', {
        expected_owner_user_id: ownerMembership.user_id,
        replacement_owner_user_id: replacementUser.id,
        target_clinic_id: payload.clinicId,
        target_performed_by: requesterData.user.id,
      })

    if (replacementError) {
      replacementState = await getReplacementState(
        adminClient,
        payload.clinicId,
        replacementUser.id,
      )

      if (replacementState === 'committed') {
        console.warn('Owner replacement succeeded after an RPC error', {
          clinicId: payload.clinicId,
          replacementOwnerUserId: replacementUser.id,
        })
      } else if (
        replacementError.message.includes('OWNER_EMAIL_ALREADY_REGISTERED')
      ) {
        throw new CorrectPlatformClinicOwnerEmailError(
          'OWNER_EMAIL_ALREADY_REGISTERED',
          'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.',
          409,
        )
      } else {
        throw replacementError
      }
    } else {
      replacementState = 'committed'
    }
  } catch (error) {
    if (replacementState === 'unknown') {
      replacementState = await getReplacementState(
        adminClient,
        payload.clinicId,
        replacementUser.id,
      ).catch(() => 'unknown')
    }

    if (replacementState === 'committed') {
      console.warn('Owner replacement recovered after a transport error', {
        clinicId: payload.clinicId,
        replacementOwnerUserId: replacementUser.id,
      })
    } else {
      if (replacementState === 'uncommitted') {
        await adminClient.auth.admin
          .deleteUser(replacementUser.id)
          .catch(() => undefined)
      }

      throw error
    }
  }

  await cleanupUnconfirmedPreviousOwner(
    adminClient,
    currentOwner,
  )

  console.info(JSON.stringify({
    event: 'dayia.platform_owner_email_corrected',
    clinicId: payload.clinicId,
    performedBy: requesterData.user.id,
    previousOwnerUserId: ownerMembership.user_id,
    replacementOwnerUserId: replacementUser.id,
  }))

  return jsonResponse({ email: payload.ownerEmail, sentAt })
}

async function upsertReplacementProfile(
  adminClient: AdminClient,
  userId: string,
  clinicId: string,
  email: string,
  fullName: string | null,
  sentAt: string,
) {
  const { data: profile, error: profileReadError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileReadError) {
    throw profileReadError
  }

  const values = {
    clinic_id: clinicId,
    email,
    full_name: fullName?.trim() || null,
    invited_at: sentAt,
    is_active: true,
    role: 'clinic_admin',
    updated_at: sentAt,
  }
  const result = profile
    ? await adminClient.from('profiles').update(values).eq('id', userId)
    : await adminClient.from('profiles').insert({ id: userId, ...values })

  if (result.error) {
    throw result.error
  }
}

async function cleanupUnconfirmedPreviousOwner(
  adminClient: AdminClient,
  owner: {
    confirmed_at?: string
    email_confirmed_at?: string
    id: string
  },
) {
  if (owner.email_confirmed_at || owner.confirmed_at) {
    return
  }

  const { count, error } = await adminClient
    .from('clinic_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', owner.id)
    .in('status', ['active', 'pending', 'pending_activation'])

  if (error || (count ?? 0) > 0) {
    return
  }

  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(owner.id)

  if (deleteError) {
    console.error('Previous pending owner could not be deleted', {
      ownerId: owner.id,
    })
  }
}

async function getReplacementState(
  adminClient: AdminClient,
  clinicId: string,
  userId: string,
): Promise<'committed' | 'uncommitted'> {
  const { data, error } = await adminClient
    .from('clinic_memberships')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('user_id', userId)
    .eq('role', 'clinic_owner')
    .eq('status', 'pending_activation')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? 'committed' : 'uncommitted'
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new CorrectPlatformClinicOwnerEmailError(
      'INVALID_PAYLOAD',
      'Ingresa un email válido para el propietario.',
      400,
    )
  }
}

function getActivationRedirectUrl() {
  const configuredAppUrl =
    Deno.env.get('DAYIA_APP_URL') ?? 'http://localhost:5173'

  return `${configuredAppUrl.replace(/\/+$/, '')}/activar-cuenta`
}

function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

function registeredEmailResponse() {
  return errorResponse(
    {
      code: 'OWNER_EMAIL_ALREADY_REGISTERED',
      message:
        'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.',
    },
    409,
  )
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
      message: 'La corrección de propietarios no está configurada.',
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
