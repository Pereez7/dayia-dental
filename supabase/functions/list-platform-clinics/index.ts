import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PublicError {
  code: string
  message: string
}

interface SupabaseClientConfig {
  anonKey: string
  serviceRoleKey: string
  supabaseUrl: string
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
    return await handleListPlatformClinics(request)
  } catch {
    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos cargar los consultorios.',
      },
      500,
    )
  }
})

async function handleListPlatformClinics(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
      405,
    )
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!authHeader || !token) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  const configResult = getSupabaseClientConfig()

  if ('error' in configResult) {
    return errorResponse(configResult.error, 500)
  }

  const { anonKey, serviceRoleKey, supabaseUrl } = configResult.config
  const requesterClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: requesterData, error: requesterError } =
    await requesterClient.auth.getUser(token)

  if (requesterError || !requesterData.user) {
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  const { data: requesterProfile, error: profileError } = await adminClient
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
        message: 'No tienes permiso para ver los consultorios.',
      },
      403,
    )
  }

  const { data: clinics, error: clinicsError } = await adminClient
    .from('clinics')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })

  if (clinicsError) {
    return dataQueryError()
  }

  if (!clinics?.length) {
    return jsonResponse({ clinics: [] })
  }

  const clinicIds = clinics.map((clinic) => clinic.id)
  const [subscriptionsResult, membershipsResult, plansResult] =
    await Promise.all([
      adminClient
        .from('clinic_subscriptions')
        .select('clinic_id, plan_id, status')
        .in('clinic_id', clinicIds),
      adminClient
        .from('clinic_memberships')
        .select('clinic_id, user_id, role, status, created_at')
        .in('clinic_id', clinicIds)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
      adminClient.from('plans').select('id, name'),
    ])

  if (
    subscriptionsResult.error ||
    membershipsResult.error ||
    plansResult.error
  ) {
    return dataQueryError()
  }

  const activeMemberships = membershipsResult.data ?? []
  const ownerMemberships = activeMemberships.filter(
    (membership) => membership.role === 'clinic_owner',
  )
  const ownerIds = [...new Set(ownerMemberships.map((owner) => owner.user_id))]
  let ownerProfiles: Array<{
    email: string | null
    full_name: string | null
    id: string
  }> = []

  if (ownerIds.length > 0) {
    const ownerProfilesResult = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ownerIds)

    if (ownerProfilesResult.error) {
      return dataQueryError()
    }

    ownerProfiles = ownerProfilesResult.data ?? []
  }

  const subscriptionsByClinic = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [
      subscription.clinic_id,
      subscription,
    ]),
  )
  const plansById = new Map(
    (plansResult.data ?? []).map((plan) => [plan.id, plan]),
  )
  const ownerProfilesById = new Map(
    ownerProfiles.map((profile) => [profile.id, profile]),
  )

  return jsonResponse({
    clinics: clinics.map((clinic) => {
      const subscription = subscriptionsByClinic.get(clinic.id)
      const plan = subscription
        ? plansById.get(subscription.plan_id)
        : undefined
      const ownerMembership = ownerMemberships.find(
        (membership) => membership.clinic_id === clinic.id,
      )
      const ownerProfile = ownerMembership
        ? ownerProfilesById.get(ownerMembership.user_id)
        : undefined

      return {
        activeMembersCount: activeMemberships.filter(
          (membership) => membership.clinic_id === clinic.id,
        ).length,
        clinicId: clinic.id,
        clinicName: clinic.name,
        // The current schema has no clinics.status column.
        clinicStatus: 'unknown',
        createdAt: clinic.created_at,
        ownerEmail: ownerProfile?.email ?? null,
        ownerName: ownerProfile?.full_name ?? null,
        planId: subscription?.plan_id ?? null,
        planName: plan?.name ?? null,
        subscriptionStatus: subscription?.status ?? null,
      }
    }),
  })
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
    config: { anonKey, serviceRoleKey, supabaseUrl },
  }
}

function dataQueryError() {
  return errorResponse(
    {
      code: 'DATA_QUERY_FAILED',
      message: 'No pudimos cargar los consultorios.',
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
