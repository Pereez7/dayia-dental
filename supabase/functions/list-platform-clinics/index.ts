import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  normalizeSubscriptionStatus,
  resolveClinicStatus,
} from '../_shared/platformAdmin.ts'

interface PublicError {
  code: string
  message: string
}

interface SupabaseClientConfig {
  anonKey: string
  serviceRoleKey: string
  supabaseUrl: string
}

interface ClinicCursor {
  createdAt: string
  id: string
}

interface ListPlatformClinicsInput {
  cursor?: ClinicCursor | null
  limit?: number
}

interface PlatformClinicSummaryRow {
  active_members_count: number
  clinic_id: string
  clinic_name: string
  clinic_status: string | null
  created_at: string
  owner_email: string | null
  owner_invitation_sent_at: string | null
  owner_membership_status: string | null
  owner_name: string | null
  pending_payment_submissions_count: number
  plan_id: string | null
  plan_name: string | null
  subscription_status: string | null
  total_count: number
}

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 25
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const inputResult = await parseInput(request)

  if ('error' in inputResult) {
    return errorResponse(inputResult.error, 400)
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

  const { cursor, limit } = inputResult.input
  const { data, error } = await adminClient.rpc(
    'list_platform_clinic_summaries',
    {
      cursor_created_at: cursor?.createdAt ?? null,
      cursor_id: cursor?.id ?? null,
      target_limit: limit,
    },
  )

  if (error) {
    return dataQueryError()
  }

  const rows = (data ?? []) as PlatformClinicSummaryRow[]
  const hasNextPage = rows.length > limit
  const visibleRows = rows.slice(0, limit)
  const lastVisibleRow = visibleRows.at(-1)

  return jsonResponse({
    clinics: visibleRows.map((row) => ({
      activeMembersCount: Number(row.active_members_count) || 0,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      clinicStatus: resolveClinicStatus(
        row.clinic_status,
        row.subscription_status,
      ),
      createdAt: row.created_at,
      ownerEmail: row.owner_email,
      ownerInvitationSentAt: row.owner_invitation_sent_at,
      ownerMembershipStatus: row.owner_membership_status,
      ownerName: row.owner_name,
      pendingPaymentSubmissionsCount:
        Number(row.pending_payment_submissions_count) || 0,
      planId: row.plan_id,
      planName: row.plan_name,
      subscriptionStatus: normalizeSubscriptionStatus(
        row.subscription_status,
      ),
    })),
    pageInfo: {
      hasNextPage,
      limit,
      nextCursor:
        hasNextPage && lastVisibleRow
          ? {
              createdAt: lastVisibleRow.created_at,
              id: lastVisibleRow.clinic_id,
            }
          : null,
      totalCount: Number(rows[0]?.total_count) || 0,
    },
  })
}

async function parseInput(
  request: Request,
): Promise<
  | { input: { cursor: ClinicCursor | null; limit: number } }
  | { error: PublicError }
> {
  let body: ListPlatformClinicsInput

  try {
    const text = await request.text()
    body = text ? JSON.parse(text) as ListPlatformClinicsInput : {}
  } catch {
    return invalidPagination()
  }

  const limit = body.limit ?? DEFAULT_PAGE_SIZE

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return invalidPagination()
  }

  if (body.cursor === undefined || body.cursor === null) {
    return { input: { cursor: null, limit } }
  }

  if (
    typeof body.cursor !== 'object' ||
    typeof body.cursor.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(body.cursor.createdAt)) ||
    typeof body.cursor.id !== 'string' ||
    !uuidPattern.test(body.cursor.id)
  ) {
    return invalidPagination()
  }

  return {
    input: {
      cursor: {
        createdAt: new Date(body.cursor.createdAt).toISOString(),
        id: body.cursor.id,
      },
      limit,
    },
  }
}

function invalidPagination() {
  return {
    error: {
      code: 'INVALID_PAGINATION',
      message: 'La página solicitada no es válida.',
    },
  } as const
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
