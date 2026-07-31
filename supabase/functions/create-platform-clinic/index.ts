import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { lookupAuthUserByEmail } from '../_shared/authUserLookup.ts'
import {
  assertPlatformClinicCreationAllowed,
  createPlatformClinicRecords,
  CreatePlatformClinicError,
  normalizeCreatePlatformClinicPayload,
  type CreatePlatformClinicRepository,
  type PlatformClinicCreationRequest,
} from '../_shared/createPlatformClinic.ts'
import {
  createEdgePerformanceRecorder,
  resolvePerformanceOperationId,
  type EdgePerformanceInstrumentation,
  type EdgePerformanceSnapshot,
} from '../_shared/performance.ts'

interface PublicError {
  code: string
  message: string
}

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-dayia-operation-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers':
    'Server-Timing, X-Dayia-Operation-Id',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  const operationId = resolvePerformanceOperationId(
    request.headers.get('X-Dayia-Operation-Id'),
  )
  const performance = createEdgePerformanceRecorder(
    'create_platform_clinic',
    operationId,
  )
  let response: Response

  try {
    response = await handleCreatePlatformClinic(
      request,
      operationId,
      performance,
    )
  } catch (error) {
    if (error instanceof CreatePlatformClinicError) {
      response = errorResponse(
        { code: error.code, message: error.message },
        error.status,
      )
    } else {
      response = errorResponse(
        {
          code: 'UNEXPECTED_ERROR',
          message: 'No pudimos preparar el consultorio. Intenta nuevamente.',
        },
        500,
      )
    }
  }

  const snapshot = performance.complete(response.status)
  console.info(JSON.stringify(snapshot.log))

  return withPerformanceHeaders(response, operationId, snapshot)
})

async function handleCreatePlatformClinic(
  request: Request,
  operationId: string,
  performance: EdgePerformanceInstrumentation,
) {
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
    await performance.measure(
      'auth_user',
      () => requesterClient.auth.getUser(token),
    )

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
  const { data: requesterProfile, error: profileError } =
    await performance.measure(
      'platform_authorization',
      async () =>
        await requesterClient
          .from('profiles')
          .select('is_platform_admin')
          .eq('id', requesterData.user.id)
          .maybeSingle(),
    )

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

  const payload = await performance.measure(
    'payload_validation',
    async () =>
      normalizeCreatePlatformClinicPayload(await readJson(request)),
  )
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
  const repository = createRepository(
    adminClient,
    getActivationRedirectUrl(),
  )
  const response = await createPlatformClinicRecords(
    payload,
    {
      requestedBy: requesterData.user.id,
      requestId: operationId,
    },
    repository,
    performance,
  )

  return jsonResponse(response, 201)
}

function createRepository(
  adminClient: AdminClient,
  activationRedirectUrl: string,
): CreatePlatformClinicRepository {
  return {
    async beginCreation(input, context) {
      const { data, error } = await adminClient.rpc(
        'begin_platform_clinic_creation',
        {
          target_clinic_name: input.clinicName,
          target_owner_email: input.ownerEmail,
          target_owner_name: input.ownerName,
          target_payload_fingerprint: context.payloadFingerprint,
          target_plan_id: input.planId,
          target_price_tier: input.priceTier,
          target_request_id: context.requestId,
          target_requested_by: context.requestedBy,
        },
      )

      if (error) {
        throw mapRepositoryError(error)
      }

      return parseCreationRequest(data)
    },

    async completeCreation(requestId, ownerId) {
      const { data, error } = await adminClient.rpc(
        'complete_platform_clinic_creation',
        {
          target_owner_user_id: ownerId,
          target_request_id: requestId,
        },
      )

      if (error) {
        throw mapRepositoryError(error)
      }

      return parseCreationRequest(data)
    },

    async createOwnerInvitation(email, fullName, requestId) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            dayia_creation_request_id: requestId,
            full_name: fullName,
          },
          redirectTo: activationRedirectUrl,
        },
      )

      if (error || !data.user) {
        if (error?.status === 429) {
          throw new CreatePlatformClinicError(
            'INVITATION_RATE_LIMITED',
            'No pudimos enviar la invitación por el momento. Intenta nuevamente más tarde.',
            429,
          )
        }

        if (
          error?.status === 422 ||
          error?.message.toLowerCase().includes('already')
        ) {
          throw new CreatePlatformClinicError(
            'OWNER_EMAIL_ALREADY_REGISTERED',
            'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.',
            409,
          )
        }

        throw error ?? new Error('Owner invitation was not created')
      }

      return {
        creationRequestId: requestId,
        email: data.user.email?.trim().toLowerCase() || email,
        id: data.user.id,
        isConfirmed: Boolean(
          data.user.email_confirmed_at || data.user.confirmed_at,
        ),
      }
    },

    async findOwnerByEmail(email) {
      return await lookupAuthUserByEmail(adminClient, email)
    },

    async getCreation(requestId) {
      const { data, error } = await adminClient.rpc(
        'get_platform_clinic_creation_request',
        { target_request_id: requestId },
      )

      if (error) {
        throw mapRepositoryError(error)
      }

      return data === null ? null : parseCreationRequest(data)
    },

    async failCreation(requestId, errorCode) {
      const { error } = await adminClient.rpc(
        'fail_platform_clinic_creation',
        {
          target_error_code: errorCode,
          target_request_id: requestId,
        },
      )

      if (error) {
        throw mapRepositoryError(error)
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

function parseCreationRequest(data: unknown): PlatformClinicCreationRequest {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Clinic creation returned an invalid response')
  }

  const candidate = data as Record<string, unknown>
  const status = candidate.status
  const activationStatus = candidate.activationStatus
  const planId = candidate.planId
  const priceTier = candidate.priceTier

  if (
    typeof candidate.requestId !== 'string' ||
    typeof candidate.clinicName !== 'string' ||
    typeof candidate.ownerEmail !== 'string' ||
    typeof candidate.ownerName !== 'string' ||
    !['reserved', 'completed', 'failed'].includes(String(status)) ||
    !['basic', 'medium', 'pro'].includes(String(planId)) ||
    !['standard', 'founder'].includes(String(priceTier)) ||
    !(
      activationStatus === null ||
      activationStatus === 'pending' ||
      activationStatus === 'already_active'
    ) ||
    !(candidate.clinicId === null || typeof candidate.clinicId === 'string') ||
    !(
      candidate.ownerUserId === null ||
      typeof candidate.ownerUserId === 'string'
    )
  ) {
    throw new Error('Clinic creation returned invalid state')
  }

  return {
    activationStatus,
    clinicId: candidate.clinicId as string | null,
    clinicName: candidate.clinicName,
    ownerEmail: candidate.ownerEmail,
    ownerName: candidate.ownerName,
    ownerUserId: candidate.ownerUserId as string | null,
    planId: planId as PlatformClinicCreationRequest['planId'],
    priceTier: priceTier as PlatformClinicCreationRequest['priceTier'],
    requestId: candidate.requestId,
    status: status as PlatformClinicCreationRequest['status'],
  }
}

function mapRepositoryError(error: { message: string }) {
  const code = [
    'CLINIC_ALREADY_EXISTS',
    'CLINIC_CREATION_IN_PROGRESS',
    'OWNER_EMAIL_ALREADY_REGISTERED',
    'OWNER_EMAIL_CREATION_IN_PROGRESS',
    'FOUNDER_PRICE_NOT_CONFIGURED',
    'INVALID_PLAN',
    'INVALID_PAYLOAD',
    'FORBIDDEN',
    'REQUEST_PAYLOAD_MISMATCH',
    'CREATION_REQUEST_NOT_FOUND',
    'CREATION_REQUEST_NOT_RESERVED',
    'OWNER_AUTH_USER_NOT_FOUND',
    'OWNER_REQUEST_MISMATCH',
  ].find((candidate) => error.message.includes(candidate))

  switch (code) {
    case 'CLINIC_ALREADY_EXISTS':
      return new CreatePlatformClinicError(
        code,
        'Ya existe un consultorio con ese nombre.',
        409,
      )
    case 'CLINIC_CREATION_IN_PROGRESS':
      return new CreatePlatformClinicError(
        code,
        'Ese consultorio ya se está preparando. Actualiza el listado en unos momentos.',
        409,
      )
    case 'OWNER_EMAIL_ALREADY_REGISTERED':
    case 'OWNER_REQUEST_MISMATCH':
      return new CreatePlatformClinicError(
        'OWNER_EMAIL_ALREADY_REGISTERED',
        'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.',
        409,
      )
    case 'OWNER_EMAIL_CREATION_IN_PROGRESS':
      return new CreatePlatformClinicError(
        code,
        'Ese correo ya se está usando en otra alta. Actualiza el listado en unos momentos.',
        409,
      )
    case 'FOUNDER_PRICE_NOT_CONFIGURED':
      return new CreatePlatformClinicError(
        code,
        'La tarifa fundador no está configurada para el plan seleccionado.',
        409,
      )
    case 'INVALID_PLAN':
      return new CreatePlatformClinicError(
        code,
        'El plan seleccionado no está disponible.',
        400,
      )
    case 'INVALID_PAYLOAD':
      return new CreatePlatformClinicError(
        code,
        'Revisa los datos del consultorio.',
        400,
      )
    case 'FORBIDDEN':
      return new CreatePlatformClinicError(
        code,
        'No tienes permiso para crear consultorios.',
        403,
      )
    case 'REQUEST_PAYLOAD_MISMATCH':
      return new CreatePlatformClinicError(
        code,
        'La solicitud de alta no coincide con los datos originales.',
        409,
      )
    case 'CREATION_REQUEST_NOT_FOUND':
    case 'CREATION_REQUEST_NOT_RESERVED':
    case 'OWNER_AUTH_USER_NOT_FOUND':
      return new CreatePlatformClinicError(
        code,
        'No pudimos confirmar el alta. Espera un momento e intenta nuevamente.',
        503,
      )
    default:
      return new Error(error.message)
  }
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

function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

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

function withPerformanceHeaders(
  response: Response,
  operationId: string,
  snapshot: EdgePerformanceSnapshot,
) {
  const headers = new Headers(response.headers)
  headers.set('Server-Timing', snapshot.serverTiming)
  headers.set('X-Dayia-Operation-Id', operationId)

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}
