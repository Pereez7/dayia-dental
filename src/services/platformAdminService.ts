import { supabase } from '../lib/supabaseClient'
import type {
  CreatePlatformClinicInput,
  CreatePlatformClinicResponse,
  ListPlatformClinicsResponse,
  PlatformClinicStatus,
  PlatformClinicSummary,
  PlatformSubscriptionStatus,
} from '../types/platform'

export interface PlatformAdminServiceResult {
  data: PlatformClinicSummary[] | null
  error: string | null
}

export interface CreatePlatformClinicServiceResult {
  data: CreatePlatformClinicResponse | null
  error: string | null
}

interface PlatformAdminFunctionClient {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null }
      error: unknown
    }>
  }
  functions: {
    invoke: (
      functionName: string,
      options: {
        body?: CreatePlatformClinicInput
        headers: { Authorization: string }
        method: 'POST'
      },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

const clinicStatuses = new Set<PlatformClinicStatus>([
  'active',
  'pending_activation',
  'suspended',
  'unknown',
])

const subscriptionStatuses = new Set<PlatformSubscriptionStatus>([
  'active',
  'canceled',
  'past_due',
  'trialing',
  'unknown',
])

export async function listPlatformClinics(): Promise<PlatformAdminServiceResult> {
  return listPlatformClinicsWithClient(
    supabase as PlatformAdminFunctionClient | null,
  )
}

export async function createPlatformClinic(
  input: CreatePlatformClinicInput,
): Promise<CreatePlatformClinicServiceResult> {
  return createPlatformClinicWithClient(
    supabase as PlatformAdminFunctionClient | null,
    input,
  )
}

export async function createPlatformClinicWithClient(
  client: PlatformAdminFunctionClient | null,
  input: CreatePlatformClinicInput,
): Promise<CreatePlatformClinicServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      data: null,
      error: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
    }
  }

  const { data, error } = await client.functions.invoke(
    'create-platform-clinic',
    {
      body: input,
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'POST',
    },
  )

  if (error) {
    return { data: null, error: await getCreateClinicErrorMessage(error) }
  }

  if (!isCreatePlatformClinicResponse(data)) {
    return { data: null, error: 'No pudimos preparar el consultorio.' }
  }

  return { data, error: null }
}

export async function listPlatformClinicsWithClient(
  client: PlatformAdminFunctionClient | null,
): Promise<PlatformAdminServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      data: null,
      error: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
    }
  }

  const { data, error } = await client.functions.invoke(
    'list-platform-clinics',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'POST',
    },
  )

  if (error) {
    return { data: null, error: getPlatformAdminErrorMessage(error) }
  }

  if (!isListPlatformClinicsResponse(data)) {
    return { data: null, error: 'No pudimos cargar los consultorios.' }
  }

  return {
    data: data.clinics.map(mapPlatformClinicSummary),
    error: null,
  }
}

export function mapPlatformClinicSummary(
  clinic: PlatformClinicSummary,
): PlatformClinicSummary {
  return {
    activeMembersCount: Number.isFinite(clinic.activeMembersCount)
      ? Math.max(0, clinic.activeMembersCount)
      : 0,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName.trim() || 'Consultorio sin nombre',
    clinicStatus: clinic.clinicStatus && clinicStatuses.has(clinic.clinicStatus)
      ? clinic.clinicStatus
      : 'unknown',
    createdAt: clinic.createdAt,
    ownerEmail: clinic.ownerEmail?.trim() || null,
    ownerName: clinic.ownerName?.trim() || null,
    planId: clinic.planId?.trim() || null,
    planName: getPlatformPlanName(clinic.planId, clinic.planName),
    subscriptionStatus:
      clinic.subscriptionStatus &&
      subscriptionStatuses.has(clinic.subscriptionStatus)
        ? clinic.subscriptionStatus
        : clinic.subscriptionStatus === null
          ? null
          : 'unknown',
  }
}

function getPlatformPlanName(planId: string | null, planName: string | null) {
  const knownPlanNames: Record<string, string> = {
    basic: 'Basic',
    medium: 'Medium',
    pro: 'Pro',
  }
  const normalizedPlanId = planId?.trim().toLowerCase()

  return normalizedPlanId
    ? knownPlanNames[normalizedPlanId] ?? planName?.trim() ?? null
    : planName?.trim() || null
}

export function getPlatformAdminErrorMessage(error: unknown) {
  const status = getFunctionErrorStatus(error)

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para ver los consultorios.'
  }

  return 'No pudimos cargar los consultorios.'
}

function getFunctionErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const candidate = error as {
    context?: { status?: number }
    status?: number
  }

  return candidate.context?.status ?? candidate.status ?? null
}

async function getCreateClinicErrorMessage(error: unknown) {
  const status = getFunctionErrorStatus(error)
  const responseMessage = await getFunctionResponseMessage(error)

  if (status === 400) {
    return responseMessage ?? 'Revisa los datos del consultorio.'
  }

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para crear consultorios.'
  }

  if (status === 409) {
    return responseMessage ?? 'No pudimos crear el consultorio por un conflicto.'
  }

  return 'No pudimos preparar el consultorio. Intenta nuevamente.'
}

async function getFunctionResponseMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const context = (error as { context?: unknown }).context

  if (!(context instanceof Response)) {
    return null
  }

  try {
    const payload = await context.clone().json() as { message?: unknown }
    return typeof payload.message === 'string' ? payload.message : null
  } catch {
    return null
  }
}

function isCreatePlatformClinicResponse(
  value: unknown,
): value is CreatePlatformClinicResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CreatePlatformClinicResponse>
  const activationStatuses = new Set([
    'pending',
    'already_active',
    'not_sent',
  ])

  return Boolean(
    candidate.clinic &&
      typeof candidate.clinic.clinicId === 'string' &&
      typeof candidate.clinic.clinicName === 'string' &&
      candidate.clinic.clinicStatus === 'pending_activation' &&
      candidate.activation &&
      activationStatuses.has(candidate.activation.status ?? ''),
  )
}

function isListPlatformClinicsResponse(
  value: unknown,
): value is ListPlatformClinicsResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as ListPlatformClinicsResponse).clinics),
  )
}
