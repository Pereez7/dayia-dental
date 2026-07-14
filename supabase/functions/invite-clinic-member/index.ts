import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  assertMembershipLimit,
  assertNoClinicMembership,
  ClinicMemberError,
  getManagedPlanLimit,
  isCountedMembershipStatus,
  normalizeInviteClinicMemberPayload,
} from '../_shared/clinicMembers.ts'

interface PublicError {
  code: string
  message: string
}

interface ClinicMemberRow {
  activated_at: string | null
  clinic_id: string
  created_at: string
  invited_at: string | null
  role: string
  status: string
  user_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    return await handleClinicMembersRequest(request)
  } catch (error) {
    if (error instanceof ClinicMemberError) {
      return errorResponse({ code: error.code, message: error.message }, error.status)
    }

    console.error('invite-clinic-member unexpected failure', error)
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos gestionar los usuarios del consultorio.',
      },
      500,
    )
  }
})

async function handleClinicMembersRequest(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    throw new ClinicMemberError('METHOD_NOT_ALLOWED', 'Método no permitido.', 405)
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

  // Membership, role and plan are validated under the requester's JWT and RLS.
  const { data: activeMemberships, error: membershipError } =
    await requesterClient
      .from('clinic_memberships')
      .select('clinic_id, role, activated_at, created_at')
      .eq('user_id', requesterData.user.id)
      .eq('status', 'active')
      .order('activated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

  if (membershipError) {
    throw new ClinicMemberError(
      'MEMBERSHIP_QUERY_FAILED',
      'No pudimos validar tu acceso al consultorio.',
      500,
    )
  }

  const activeMembership = activeMemberships?.[0]

  if (!activeMembership) {
    throw new ClinicMemberError(
      'CLINIC_NOT_LINKED',
      'No tienes un consultorio activo.',
      403,
    )
  }

  if (activeMembership.role !== 'clinic_owner' && activeMembership.role !== 'clinic_admin') {
    throw new ClinicMemberError(
      'FORBIDDEN',
      'No tienes permiso para gestionar usuarios.',
      403,
    )
  }

  const { data: subscription, error: subscriptionError } = await requesterClient
    .from('clinic_subscriptions')
    .select('plan_id, status')
    .eq('clinic_id', activeMembership.clinic_id)
    .in('status', ['trial', 'active'])
    .maybeSingle()

  if (subscriptionError || !subscription) {
    throw new ClinicMemberError(
      'SUBSCRIPTION_NOT_AVAILABLE',
      'El consultorio no tiene una suscripción activa.',
      403,
    )
  }

  const { data: plan, error: planError } = await requesterClient
    .from('plans')
    .select('id, max_users, can_manage_team')
    .eq('id', subscription.plan_id)
    .eq('is_active', true)
    .maybeSingle()

  if (planError || !plan || plan.can_manage_team !== true) {
    throw new ClinicMemberError(
      'PLAN_NOT_ELIGIBLE',
      'Tu plan actual no permite gestionar usuarios del consultorio.',
      403,
    )
  }

  const maxUsers = getManagedPlanLimit(plan.id, plan.max_users)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    throw configurationError()
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
  const members = await listClinicMembers(adminClient, activeMembership.clinic_id)
  const memberCount = members.filter((member) =>
    isCountedMembershipStatus(member.status),
  ).length

  if (request.method === 'GET') {
    return jsonResponse({
      memberCount,
      members: await attachProfiles(adminClient, members),
      plan: { id: plan.id, maxUsers },
    })
  }

  const payload = normalizeInviteClinicMemberPayload(await readJson(request))
  const authUser = await findAuthUserByEmail(adminClient, payload.email)
  assertNoClinicMembership(
    Boolean(authUser && members.some((member) => member.user_id === authUser.id)),
  )
  assertMembershipLimit({ currentCount: memberCount, maxUsers, planId: plan.id })

  const now = new Date().toISOString()
  let userId = authUser?.id
  let createdAuthUser = false
  let activationStatus: 'already_active' | 'not_sent' | 'pending'
  let membershipStatus: 'active' | 'pending_activation'

  if (!authUser) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
      payload.email,
      {
        data: { full_name: payload.fullName },
        redirectTo: getActivationRedirectUrl(),
      },
    )

    if (error || !data.user) {
      throw new ClinicMemberError(
        'INVITATION_SEND_ERROR',
        'No pudimos enviar la invitación del nuevo usuario.',
        500,
      )
    }

    userId = data.user.id
    createdAuthUser = true
    activationStatus = 'pending'
    membershipStatus = 'pending_activation'
  } else if (authUser.email_confirmed_at || authUser.confirmed_at) {
    activationStatus = 'already_active'
    membershipStatus = 'active'
  } else {
    activationStatus = 'not_sent'
    membershipStatus = 'pending_activation'
  }

  try {
    const profile = await ensureProfile(adminClient, {
      clinicId: activeMembership.clinic_id,
      email: payload.email,
      fullName: payload.fullName,
      invitedAt: now,
      isNewUser: createdAuthUser,
      role: payload.role,
      userId: userId as string,
    })
    const activatedAt = membershipStatus === 'active' ? now : null
    const { error: insertError } = await adminClient.rpc(
      'insert_clinic_membership_with_limit',
      {
        target_activated_at: activatedAt,
        target_clinic_id: activeMembership.clinic_id,
        target_invited_at: now,
        target_role: payload.role,
        target_status: membershipStatus,
        target_user_id: userId,
      },
    )

    if (insertError) {
      if (
        insertError.code === '23505' ||
        insertError.message.includes('MEMBERSHIP_ALREADY_EXISTS')
      ) {
        throw new ClinicMemberError(
          'MEMBERSHIP_ALREADY_EXISTS',
          'Este usuario ya pertenece al consultorio.',
          409,
        )
      }
      if (insertError.message.includes('MEMBER_LIMIT_REACHED')) {
        throw new ClinicMemberError(
          'MEMBER_LIMIT_REACHED',
          'Tu plan alcanzó el límite de usuarios.',
          409,
        )
      }
      if (insertError.message.includes('PLAN_NOT_ELIGIBLE')) {
        throw new ClinicMemberError(
          'PLAN_NOT_ELIGIBLE',
          'Tu plan actual no permite gestionar usuarios del consultorio.',
          403,
        )
      }
      throw insertError
    }

    return jsonResponse(
      {
        activation: { status: activationStatus },
        member: {
          activatedAt,
          clinicId: activeMembership.clinic_id,
          createdAt: now,
          email: profile.email,
          fullName: profile.fullName,
          invitedAt: now,
          role: payload.role,
          status: membershipStatus,
          userId,
        },
      },
      201,
    )
  } catch (error) {
    if (createdAuthUser && userId) {
      await adminClient.auth.admin.deleteUser(userId)
    }
    throw error
  }
}

async function listClinicMembers(
  adminClient: AdminClient,
  clinicId: string,
): Promise<ClinicMemberRow[]> {
  const { data, error } = await adminClient
    .from('clinic_memberships')
    .select('user_id, clinic_id, role, status, invited_at, activated_at, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ClinicMemberRow[]
}

async function attachProfiles(
  adminClient: AdminClient,
  memberships: ClinicMemberRow[],
) {
  const userIds = memberships.map((membership) => membership.user_id)

  if (userIds.length === 0) {
    return []
  }

  const { data: profiles, error } = await adminClient
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  if (error) {
    throw error
  }

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id)
    return {
      activatedAt: membership.activated_at,
      clinicId: membership.clinic_id,
      createdAt: membership.created_at,
      email: profile?.email?.trim().toLowerCase() || null,
      fullName: profile?.full_name?.trim() || 'Usuario sin nombre',
      invitedAt: membership.invited_at,
      role: membership.role,
      status: membership.status,
      userId: membership.user_id,
    }
  })
}

async function ensureProfile(
  adminClient: AdminClient,
  input: {
    clinicId: string
    email: string
    fullName: string
    invitedAt: string
    isNewUser: boolean
    role: string
    userId: string
  },
) {
  const { data: existingProfile, error: readError } = await adminClient
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', input.userId)
    .maybeSingle()

  if (readError) {
    throw readError
  }

  if (!existingProfile) {
    const { error } = await adminClient.from('profiles').insert({
      clinic_id: input.clinicId,
      email: input.email,
      full_name: input.fullName,
      id: input.userId,
      invited_at: input.invitedAt,
      is_active: !input.isNewUser,
      is_platform_admin: false,
      role: input.role,
    })

    if (error) {
      throw error
    }

    return { email: input.email, fullName: input.fullName }
  }

  const updates: Record<string, unknown> = { invited_at: input.invitedAt }
  if (!existingProfile.email?.trim()) updates.email = input.email
  if (!existingProfile.full_name?.trim()) updates.full_name = input.fullName
  if (input.isNewUser) {
    updates.clinic_id = input.clinicId
    updates.is_active = false
    updates.is_platform_admin = false
    updates.role = input.role
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', input.userId)

  if (updateError) {
    throw updateError
  }

  return {
    email: existingProfile.email?.trim().toLowerCase() || input.email,
    fullName: existingProfile.full_name?.trim() || input.fullName,
  }
}

async function findAuthUserByEmail(
  adminClient: AdminClient,
  email: string,
) {
  const perPage = 200

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    )
    if (match || data.users.length < perPage) return match ?? null
  }

  throw new Error('Auth user lookup exceeded the safe page limit')
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ClinicMemberError(
      'INVALID_PAYLOAD',
      'Revisa el nombre, email y rol antes de continuar.',
      400,
    )
  }
}

function getActivationRedirectUrl() {
  const appUrl = Deno.env.get('DAYIA_APP_URL') ?? 'http://localhost:5173'
  return `${appUrl.replace(/\/+$/, '')}/activar-cuenta`
}

function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

function unauthorizedError() {
  return new ClinicMemberError(
    'UNAUTHORIZED',
    'Tu sesión no es válida. Vuelve a iniciar sesión.',
    401,
  )
}

function configurationError() {
  return new ClinicMemberError(
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
