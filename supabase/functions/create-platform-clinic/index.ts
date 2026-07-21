import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  assertPlatformClinicCreationAllowed,
  createPlatformClinicRecords,
  CreatePlatformClinicError,
  getInitialClinicTrial,
  normalizeCreatePlatformClinicPayload,
  type CreatePlatformClinicRepository,
  type PlatformClinicOwner,
} from '../_shared/createPlatformClinic.ts'

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
    return await handleCreatePlatformClinic(request)
  } catch (error) {
    if (error instanceof CreatePlatformClinicError) {
      return errorResponse(
        { code: error.code, message: error.message },
        error.status,
      )
    }

    return errorResponse(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'No pudimos preparar el consultorio. Intenta nuevamente.',
      },
      500,
    )
  }
})

async function handleCreatePlatformClinic(request: Request) {
  if (request.method !== 'POST') {
    return errorResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' },
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
    return errorResponse(
      {
        code: 'UNAUTHORIZED',
        message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      401,
    )
  }

  // This query uses the requester's JWT and the "read own profile" RLS policy.
  // service_role is intentionally not read or initialized before authorization.
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

  assertPlatformClinicCreationAllowed(
    requesterProfile?.is_platform_admin === true,
    Deno.env.get('DAYIA_PLATFORM_CREATE_ENABLED'),
  )

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return configurationError()
  }

  const payload = normalizeCreatePlatformClinicPayload(await readJson(request))
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const repository = createRepository(
    adminClient,
    getActivationRedirectUrl(),
  )
  const response = await createPlatformClinicRecords(payload, repository)

  return jsonResponse(response, 201)
}

function createRepository(
  adminClient: ReturnType<typeof createClient>,
  activationRedirectUrl: string,
): CreatePlatformClinicRepository {
  return {
    async findClinicByNormalizedName(name) {
      const { data, error } = await adminClient
        .from('clinics')
        .select('id, name')
        .ilike('name', escapeLikePattern(name))
        .limit(20)

      if (error) {
        throw error
      }

      return (data ?? []).some(
        (clinic) => normalizeComparableName(clinic.name) === normalizeComparableName(name),
      )
    },

    async createClinic(name) {
      const { data, error } = await adminClient
        .from('clinics')
        .insert({ name, status: 'pending_activation' })
        .select('id')
        .single()

      if (error || !data) {
        if (error?.code === '23505') {
          throw new CreatePlatformClinicError(
            'CLINIC_ALREADY_EXISTS',
            'Ya existe un consultorio con ese nombre.',
            409,
          )
        }

        throw error ?? new Error('Clinic was not created')
      }

      return data
    },

    async findOwnerByEmail(email) {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, is_active')
        .eq('email', email)
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (profile) {
        const { data: authData, error: authError } =
          await adminClient.auth.admin.getUserById(profile.id)

        if (authError || !authData.user) {
          throw authError ?? new Error('Owner Auth user was not found')
        }

        return mapOwner(authData.user, profile)
      }

      const authUser = await findAuthUserByEmail(adminClient, email)

      if (!authUser) {
        return null
      }

      const { data: authProfile, error: authProfileError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, is_active')
        .eq('id', authUser.id)
        .maybeSingle()

      if (authProfileError) {
        throw authProfileError
      }

      if (!authProfile) {
        const { data: createdProfile, error: createdProfileError } =
          await adminClient
            .from('profiles')
            .insert({
              email,
              full_name: null,
              id: authUser.id,
              is_active: true,
              role: 'clinic_admin',
            })
            .select('id, email, full_name, is_active')
            .single()

        if (createdProfileError || !createdProfile) {
          throw createdProfileError ?? new Error('Owner profile was not created')
        }

        return mapOwner(authUser, createdProfile)
      }

      return mapOwner(authUser, authProfile)
    },

    async updateOwnerProfileIfMissing(ownerId, email, fullName) {
      const { data: profile, error: readError } = await adminClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerId)
        .single()

      if (readError) {
        throw readError
      }

      const updates: Record<string, string> = {}

      if (!profile.email?.trim()) {
        updates.email = email
      }

      if (!profile.full_name?.trim()) {
        updates.full_name = fullName
      }

      if (Object.keys(updates).length === 0) {
        return
      }

      updates.updated_at = new Date().toISOString()
      const { error } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', ownerId)

      if (error) {
        throw error
      }
    },

    async createOwnerInvitation(clinicId, email, fullName) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name: fullName }, redirectTo: activationRedirectUrl },
      )

      if (error || !data.user) {
        throw error ?? new Error('Owner invitation was not created')
      }

      const now = new Date().toISOString()
      const { data: existingProfile, error: profileReadError } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileReadError) {
        await adminClient.auth.admin.deleteUser(data.user.id)
        throw profileReadError
      }

      if (existingProfile) {
        const updates: Record<string, unknown> = {
          clinic_id: clinicId,
          email,
          invited_at: now,
          role: 'clinic_admin',
          updated_at: now,
        }

        if (!existingProfile.full_name?.trim()) {
          updates.full_name = fullName
        }

        const { error: updateError } = await adminClient
          .from('profiles')
          .update(updates)
          .eq('id', data.user.id)

        if (updateError) {
          await adminClient.auth.admin.deleteUser(data.user.id)
          throw updateError
        }
      } else {
        const { error: insertError } = await adminClient.from('profiles').insert({
          clinic_id: clinicId,
          email,
          full_name: fullName,
          id: data.user.id,
          invited_at: now,
          is_active: true,
          role: 'clinic_admin',
        })

        if (insertError) {
          await adminClient.auth.admin.deleteUser(data.user.id)
          throw insertError
        }
      }

      return {
        activationStatus: 'pending',
        owner: {
          email,
          fullName,
          id: data.user.id,
          isActive: false,
        },
      }
    },

    async createMembership(clinicId, ownerId, status) {
      const now = new Date().toISOString()
      const { error } = await adminClient.from('clinic_memberships').insert({
        activated_at: status === 'active' ? now : null,
        clinic_id: clinicId,
        invited_at: status === 'pending_activation' ? now : null,
        role: 'clinic_owner',
        status,
        user_id: ownerId,
      })

      if (error) {
        throw error
      }
    },

    async createSubscription(clinicId, planId, priceTier) {
      const { data: plan, error: planError } = await adminClient
        .from('plans')
        .select('id, founder_monthly_price')
        .eq('id', planId)
        .eq('is_active', true)
        .maybeSingle()

      if (planError || !plan) {
        throw new CreatePlatformClinicError(
          'INVALID_PLAN',
          'El plan seleccionado no está disponible.',
          400,
        )
      }

      if (
        priceTier === 'founder' &&
        (plan.founder_monthly_price === null ||
          Number(plan.founder_monthly_price) <= 0)
      ) {
        throw new CreatePlatformClinicError(
          'FOUNDER_PRICE_NOT_CONFIGURED',
          'La tarifa fundador no está configurada para el plan seleccionado.',
          409,
        )
      }

      const trial = getInitialClinicTrial()
      const { error } = await adminClient.from('clinic_subscriptions').insert({
        billing_cycle: 'trial',
        blocked_at: null,
        clinic_id: clinicId,
        current_period_ends_at: trial.trialEndsAt,
        current_period_starts_at: trial.trialStartsAt,
        ends_at: trial.trialEndsAt,
        grace_ends_at: trial.graceEndsAt,
        is_lifetime: false,
        payment_status: 'trial',
        plan_id: planId,
        price_tier: priceTier,
        founder_price_locked: priceTier === 'founder',
        starts_at: trial.trialStartsAt,
        status: 'trialing',
        trial_ends_at: trial.trialEndsAt,
        trial_starts_at: trial.trialStartsAt,
      })

      if (error) {
        throw error
      }
    },

    async deleteClinic(clinicId) {
      const { error } = await adminClient.from('clinics').delete().eq('id', clinicId)

      if (error) {
        throw error
      }
    },

    async deleteCreatedOwner(ownerId) {
      const { error } = await adminClient.auth.admin.deleteUser(ownerId)

      if (error) {
        throw error
      }
    },
  }
}

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
) {
  const perPage = 200

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw error
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    )

    if (match || data.users.length < perPage) {
      return match ?? null
    }
  }

  throw new Error('Auth user lookup exceeded the safe page limit')
}

function mapOwner(
  user: {
    confirmed_at?: string
    email?: string
    email_confirmed_at?: string
    id: string
  },
  profile: {
    email: string | null
    full_name: string | null
    is_active?: boolean
  },
): PlatformClinicOwner {
  return {
    email: profile.email?.trim().toLowerCase() || user.email?.toLowerCase() || '',
    fullName: profile.full_name?.trim() || null,
    id: user.id,
    isActive:
      profile.is_active !== false &&
      Boolean(user.email_confirmed_at || user.confirmed_at),
  }
}

function normalizeComparableName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new CreatePlatformClinicError(
      'INVALID_PAYLOAD',
      'Envía datos válidos para el consultorio.',
      400,
    )
  }
}

function getActivationRedirectUrl() {
  const configuredAppUrl =
    Deno.env.get('DAYIA_APP_URL') ??
    'http://localhost:5173'

  return `${configuredAppUrl.replace(/\/+$/, '')}/activar-cuenta`
}

function configurationError() {
  return errorResponse(
    {
      code: 'SERVER_CONFIGURATION_ERROR',
      message: 'La creación de consultorios no está configurada.',
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
