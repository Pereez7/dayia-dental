import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  getTargetMembershipStatus,
  ManageClinicMemberError,
  normalizeManageClinicMemberPayload,
} from '../_shared/manageClinicMember.ts'

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
    return await handleManageClinicMember(request)
  } catch (error) {
    if (error instanceof ManageClinicMemberError) {
      return errorResponse(
        { code: error.code, message: error.message },
        error.status,
      )
    }

    console.error('manage-clinic-member unexpected failure', error)
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos actualizar el acceso del usuario.',
      },
      500,
    )
  }
})

async function handleManageClinicMember(request: Request) {
  if (request.method !== 'POST') {
    throw new ManageClinicMemberError(
      'METHOD_NOT_ALLOWED',
      'Método no permitido.',
      405,
    )
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!authHeader || !token) {
    throw unauthorizedError()
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !anonKey) {
    throw configurationError()
  }

  const requesterClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: requesterData, error: requesterError } =
    await requesterClient.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    throw unauthorizedError()
  }

  // Resolve the actor's own active management membership under their JWT.
  const { data: actorMemberships, error: actorMembershipError } =
    await requesterClient
      .from('clinic_memberships')
      .select('clinic_id, role, activated_at, created_at')
      .eq('user_id', requesterData.user.id)
      .eq('status', 'active')
      .in('role', ['clinic_owner', 'clinic_admin'])
      .order('activated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

  if (actorMembershipError) {
    throw new ManageClinicMemberError(
      'MEMBERSHIP_QUERY_FAILED',
      'No pudimos validar tu acceso al consultorio.',
      500,
    )
  }

  if (!actorMemberships?.length) {
    throw new ManageClinicMemberError(
      'FORBIDDEN',
      'No tienes permiso para gestionar usuarios.',
      403,
    )
  }

  const payload = normalizeManageClinicMemberPayload(await readJson(request))
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    throw configurationError()
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: lifecycleResult, error: lifecycleError } =
    await adminClient.rpc('update_clinic_membership_status', {
      target_membership_id: payload.membershipId,
      target_reason: payload.reason,
      target_status: getTargetMembershipStatus(payload.action),
      target_updated_by: requesterData.user.id,
    })

  if (lifecycleError) {
    throw mapLifecycleDatabaseError(lifecycleError.message)
  }

  if (!isLifecycleResult(lifecycleResult)) {
    throw new Error('Invalid membership lifecycle result')
  }

  const [
    { data: membership, error: membershipError },
    { data: profile, error: profileError },
    { count: memberCount, error: countError },
  ] = await Promise.all([
    adminClient
      .from('clinic_memberships')
      .select('id, user_id, clinic_id, role, status, invited_at, activated_at, created_at')
      .eq('id', lifecycleResult.membershipId)
      .single(),
    adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', lifecycleResult.userId)
      .single(),
    adminClient
      .from('clinic_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', lifecycleResult.clinicId)
      .in('status', ['active', 'pending', 'pending_activation']),
  ])

  if (
    membershipError ||
    profileError ||
    countError ||
    !membership ||
    !profile ||
    memberCount === null
  ) {
    throw membershipError ?? profileError ?? countError ??
      new Error('Updated membership could not be loaded')
  }

  return jsonResponse({
    member: {
      activatedAt: membership.activated_at,
      clinicId: membership.clinic_id,
      createdAt: membership.created_at,
      email: profile.email?.trim().toLowerCase() || null,
      fullName: profile.full_name?.trim() || 'Usuario sin nombre',
      invitedAt: membership.invited_at,
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
      userId: membership.user_id,
    },
    memberCount,
  })
}

function mapLifecycleDatabaseError(message: string) {
  const knownErrors: Record<
    string,
    { message: string; status: number }
  > = {
    FORBIDDEN: {
      message: 'No tienes permiso para gestionar este usuario.',
      status: 403,
    },
    INVALID_PAYLOAD: {
      message: 'No pudimos identificar la acción o el usuario.',
      status: 400,
    },
    INVALID_REASON: {
      message: 'Explica el motivo con al menos 5 caracteres.',
      status: 400,
    },
    MEMBER_LIMIT_REACHED: {
      message: 'Tu plan alcanzó el límite de usuarios.',
      status: 409,
    },
    MEMBERSHIP_NOT_FOUND: {
      message: 'No encontramos la membresía seleccionada.',
      status: 404,
    },
    MEMBERSHIP_STATE_CONFLICT: {
      message: 'El acceso del usuario cambió. Actualiza la lista.',
      status: 409,
    },
    OWNER_PROTECTED: {
      message:
        'El propietario no puede desactivarse desde la gestión de usuarios.',
      status: 409,
    },
    PLAN_NOT_ELIGIBLE: {
      message: 'Tu plan actual no permite reactivar usuarios.',
      status: 403,
    },
    SELF_ACTION_NOT_ALLOWED: {
      message: 'No puedes desactivar tu propio acceso.',
      status: 409,
    },
  }
  const code = Object.keys(knownErrors).find((candidate) =>
    message.includes(candidate),
  )

  if (!code) {
    return new Error(message)
  }

  return new ManageClinicMemberError(
    code,
    knownErrors[code].message,
    knownErrors[code].status,
  )
}

function isLifecycleResult(value: unknown): value is {
  clinicId: string
  membershipId: string
  status: 'active' | 'inactive'
  updatedAt: string
  userId: string
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.clinicId === 'string' &&
    typeof candidate.membershipId === 'string' &&
    (candidate.status === 'active' || candidate.status === 'inactive') &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.userId === 'string'
  )
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ManageClinicMemberError(
      'INVALID_PAYLOAD',
      'No pudimos identificar la acción o el usuario.',
      400,
    )
  }
}

function unauthorizedError() {
  return new ManageClinicMemberError(
    'UNAUTHORIZED',
    'Tu sesión expiró. Vuelve a iniciar sesión.',
    401,
  )
}

function configurationError() {
  return new ManageClinicMemberError(
    'SERVER_CONFIGURATION_ERROR',
    'La gestión de usuarios no está configurada en el servidor.',
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
