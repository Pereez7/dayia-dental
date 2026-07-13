import { supabase } from '../lib/supabaseClient'
import type {
  ListPlatformClinicsResponse,
  PlatformClinicStatus,
  PlatformClinicSummary,
  PlatformSubscriptionStatus,
} from '../types/platform'

export interface PlatformAdminServiceResult {
  data: PlatformClinicSummary[] | null
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
      options: { headers: { Authorization: string }; method: 'POST' },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

const clinicStatuses = new Set<PlatformClinicStatus>([
  'active',
  'inactive',
  'unknown',
])

const subscriptionStatuses = new Set<PlatformSubscriptionStatus>([
  'active',
  'cancelled',
  'past_due',
  'suspended',
  'trial',
  'unknown',
])

export async function listPlatformClinics(): Promise<PlatformAdminServiceResult> {
  return listPlatformClinicsWithClient(
    supabase as PlatformAdminFunctionClient | null,
  )
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
    clinicStatus: clinicStatuses.has(clinic.clinicStatus)
      ? clinic.clinicStatus
      : 'unknown',
    createdAt: clinic.createdAt,
    ownerEmail: clinic.ownerEmail?.trim() || null,
    ownerName: clinic.ownerName?.trim() || null,
    planId: clinic.planId?.trim() || null,
    planName: clinic.planName?.trim() || null,
    subscriptionStatus:
      clinic.subscriptionStatus &&
      subscriptionStatuses.has(clinic.subscriptionStatus)
        ? clinic.subscriptionStatus
        : clinic.subscriptionStatus === null
          ? null
          : 'unknown',
  }
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

function isListPlatformClinicsResponse(
  value: unknown,
): value is ListPlatformClinicsResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as ListPlatformClinicsResponse).clinics),
  )
}
