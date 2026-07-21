import { supabase } from '../lib/supabaseClient'
import type {
  CreatePlatformClinicInput,
  CreatePlatformClinicResponse,
  ListPlatformClinicsResponse,
  PlatformClinicStatus,
  PlatformClinicSummary,
  PlatformSubscriptionStatus,
  RegisterSubscriptionPaymentInput,
  UpdateClinicSubscriptionInput,
  VoidSubscriptionPaymentInput,
} from '../types/platform'
import { getSubscriptionAccessState } from '../utils/subscriptionBilling'

export interface PlatformAdminServiceResult {
  data: PlatformClinicSummary[] | null
  error: string | null
}

export interface CreatePlatformClinicServiceResult {
  data: CreatePlatformClinicResponse | null
  error: string | null
}

export interface PlatformSubscriptionActionResult {
  error: string | null
  success: boolean
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
        body?: unknown
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
  'blocked',
  'canceled',
  'lifetime',
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

export async function registerSubscriptionPayment(
  input: RegisterSubscriptionPaymentInput,
): Promise<PlatformSubscriptionActionResult> {
  return invokeSubscriptionAction('register-subscription-payment', input)
}

export async function updateClinicSubscription(
  input: UpdateClinicSubscriptionInput,
): Promise<PlatformSubscriptionActionResult> {
  return invokeSubscriptionAction('update-clinic-subscription', input)
}

export async function voidSubscriptionPayment(
  input: VoidSubscriptionPaymentInput,
): Promise<PlatformSubscriptionActionResult> {
  return invokeSubscriptionAction('void-subscription-payment', input)
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
    blockedAt: clinic.blockedAt ?? null,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName.trim() || 'Consultorio sin nombre',
    clinicStatus: clinic.clinicStatus && clinicStatuses.has(clinic.clinicStatus)
      ? clinic.clinicStatus
      : 'unknown',
    createdAt: clinic.createdAt,
    currency: clinic.currency?.trim() || 'BOB',
    currentPeriodEndsAt: clinic.currentPeriodEndsAt ?? null,
    graceEndsAt: clinic.graceEndsAt ?? null,
    isLifetime: clinic.isLifetime === true,
    lastPaymentAt: clinic.lastPaymentAt ?? null,
    monthlyPrice:
      clinic.monthlyPrice === null || clinic.monthlyPrice === undefined
        ? null
        : Math.max(0, Number(clinic.monthlyPrice)),
    founderMonthlyPrice: clinic.founderMonthlyPrice === null || clinic.founderMonthlyPrice === undefined
      ? null
      : Math.max(0, Number(clinic.founderMonthlyPrice)),
    planMonthlyPrices: clinic.planMonthlyPrices ?? {},
    planFounderMonthlyPrices: clinic.planFounderMonthlyPrices ?? {},
    priceTier: clinic.priceTier === 'founder' || clinic.priceTier === 'custom' ? clinic.priceTier : 'standard',
    customMonthlyPrice: clinic.customMonthlyPrice === null || clinic.customMonthlyPrice === undefined
      ? null
      : Math.max(0, Number(clinic.customMonthlyPrice)),
    founderPriceLocked: clinic.founderPriceLocked === true,
    scheduledPlanId: clinic.scheduledPlanId ?? null,
    scheduledPlanStartsAt: clinic.scheduledPlanStartsAt ?? null,
    ownerEmail: clinic.ownerEmail?.trim() || null,
    ownerName: clinic.ownerName?.trim() || null,
    planId: clinic.planId?.trim() || null,
    planName: getPlatformPlanName(clinic.planId, clinic.planName),
    paymentStatus: clinic.paymentStatus?.trim() || null,
    payments: Array.isArray(clinic.payments) ? clinic.payments : [],
    paymentSubmissions: Array.isArray(clinic.paymentSubmissions)
      ? clinic.paymentSubmissions
      : [],
    subscriptionStatus: getEffectiveSubscriptionStatus(clinic),
    trialEndsAt: clinic.trialEndsAt ?? null,
  }
}

function getEffectiveSubscriptionStatus(
  clinic: PlatformClinicSummary,
): PlatformSubscriptionStatus | null {
  const normalizedStatus =
    clinic.subscriptionStatus &&
    subscriptionStatuses.has(clinic.subscriptionStatus)
      ? clinic.subscriptionStatus
      : clinic.subscriptionStatus === null
        ? null
        : 'unknown'

  if (clinic.isLifetime || normalizedStatus === 'lifetime') return 'lifetime'
  if (normalizedStatus === 'canceled' || normalizedStatus === 'blocked') {
    return normalizedStatus
  }
  if (!normalizedStatus || normalizedStatus === 'unknown') return normalizedStatus

  const statusForAccess =
    normalizedStatus === 'trialing'
      ? 'trialing'
      : normalizedStatus === 'past_due'
        ? 'past_due'
        : 'active'
  const access = getSubscriptionAccessState({
    currentPeriodEndsAt: clinic.currentPeriodEndsAt ?? null,
    graceEndsAt: clinic.graceEndsAt ?? null,
    isLifetime: false,
    status: statusForAccess,
    trialEndsAt: clinic.trialEndsAt ?? null,
  })

  if (access.access === 'blocked') return 'blocked'
  if (access.access === 'grace') return 'past_due'
  return normalizedStatus
}

async function invokeSubscriptionAction(
  functionName:
    | 'register-subscription-payment'
    | 'update-clinic-subscription'
    | 'void-subscription-payment',
  body:
    | RegisterSubscriptionPaymentInput
    | UpdateClinicSubscriptionInput
    | VoidSubscriptionPaymentInput,
): Promise<PlatformSubscriptionActionResult> {
  return invokeSubscriptionActionWithClient(
    supabase as PlatformAdminFunctionClient | null,
    functionName,
    body,
  )
}

export async function invokeSubscriptionActionWithClient(
  client: PlatformAdminFunctionClient | null,
  functionName:
    | 'register-subscription-payment'
    | 'update-clinic-subscription'
    | 'void-subscription-payment',
  body:
    | RegisterSubscriptionPaymentInput
    | UpdateClinicSubscriptionInput
    | VoidSubscriptionPaymentInput,
): Promise<PlatformSubscriptionActionResult> {

  if (!client) return { error: 'Supabase no está configurado.', success: false }

  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      error: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      success: false,
    }
  }

  const { error } = await client.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
    method: 'POST',
  })

  if (!error) return { error: null, success: true }

  const status = getFunctionErrorStatus(error)
  if (status === 400) {
    const responseError = await getFunctionResponseError(error)
    return {
      error: responseError?.message ?? 'Revisa los datos ingresados.',
      success: false,
    }
  }
  if (status === 401) {
    return { error: 'Tu sesión no es válida. Vuelve a iniciar sesión.', success: false }
  }
  if (status === 403) {
    return { error: 'No tienes permiso para administrar suscripciones.', success: false }
  }
  if (status === 409) {
    const responseError = await getFunctionResponseError(error)
    return {
      error: responseError?.message ?? 'El cambio solicitado entra en conflicto con la suscripción actual.',
      success: false,
    }
  }

  return {
    error: 'No pudimos actualizar la suscripción. Intenta nuevamente.',
    success: false,
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
  const responseError = await getFunctionResponseError(error)

  if (status === 400) {
    return ['INVALID_PAYLOAD', 'INVALID_PLAN'].includes(
      responseError?.code ?? '',
    ) && responseError?.message
      ? responseError.message
      : 'Revisa los datos del consultorio.'
  }

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para crear consultorios.'
  }

  if (status === 409) {
    if (responseError?.code === 'PLATFORM_CREATE_DISABLED') {
      return 'La creación real de consultorios está deshabilitada.'
    }

    if (
      responseError?.code === 'CLINIC_ALREADY_EXISTS' &&
      responseError.message
    ) {
      return responseError.message
    }

    if (
      responseError?.code === 'FOUNDER_PRICE_NOT_CONFIGURED' &&
      responseError.message
    ) {
      return responseError.message
    }

    return 'No pudimos crear el consultorio por un conflicto.'
  }

  return 'No pudimos preparar el consultorio. Intenta nuevamente.'
}

async function getFunctionResponseError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const context = (error as { context?: unknown }).context

  if (!(context instanceof Response)) {
    return null
  }

  try {
    const payload = await context.clone().json() as {
      code?: unknown
      message?: unknown
    }

    return {
      code: typeof payload.code === 'string' ? payload.code : null,
      message: typeof payload.message === 'string' ? payload.message : null,
    }
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
      (candidate.clinic.priceTier === 'standard' ||
        candidate.clinic.priceTier === 'founder') &&
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
