import { supabase } from '../lib/supabaseClient'
import type {
  CorrectPlatformClinicOwnerEmailInput,
  CorrectPlatformClinicOwnerEmailResponse,
  CreatePlatformClinicInput,
  CreatePlatformClinicResponse,
  GetPlatformClinicBillingInput,
  GetPlatformClinicBillingResponse,
  ListPlatformClinicsResponse,
  ListPlatformClinicsInput,
  PlatformClinicListItem,
  PlatformClinicStatus,
  PlatformClinicSummary,
  PlatformSubscriptionStatus,
  RejectPaymentSubmissionInput,
  RegisterSubscriptionPaymentInput,
  ResendPlatformClinicInvitationResponse,
  UpdateClinicSubscriptionInput,
  VoidSubscriptionPaymentInput,
} from '../types/platform'
import { getSubscriptionAccessState } from '../utils/subscriptionBilling'
import {
  clientPerformanceInstrumentation,
  createClientPerformanceEvent,
  elapsedMilliseconds,
  type PerformanceOperationContext,
} from '../utils/performanceTelemetry'

export interface PlatformAdminServiceResult {
  data: ListPlatformClinicsResponse | null
  error: string | null
}

export interface PlatformClinicBillingServiceResult {
  data: GetPlatformClinicBillingResponse | null
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

export interface ResendPlatformClinicInvitationServiceResult {
  data: ResendPlatformClinicInvitationResponse | null
  error: string | null
}

export interface CorrectPlatformClinicOwnerEmailServiceResult {
  data: CorrectPlatformClinicOwnerEmailResponse | null
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
        body?: unknown
        headers: { Authorization: string } & Record<string, string>
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

const ownerMembershipStatuses = new Set([
  'active',
  'pending_activation',
])

export async function listPlatformClinics(
  input: ListPlatformClinicsInput = {},
): Promise<PlatformAdminServiceResult> {
  return listPlatformClinicsWithClient(
    supabase as PlatformAdminFunctionClient | null,
    input,
  )
}

export async function getPlatformClinicBilling(
  input: GetPlatformClinicBillingInput,
): Promise<PlatformClinicBillingServiceResult> {
  return getPlatformClinicBillingWithClient(
    supabase as PlatformAdminFunctionClient | null,
    input,
  )
}

export async function createPlatformClinic(
  input: CreatePlatformClinicInput,
  performanceContext?: PerformanceOperationContext,
): Promise<CreatePlatformClinicServiceResult> {
  const context = performanceContext ?? {
    operationId: clientPerformanceInstrumentation.createOperationId(),
  }

  return createPlatformClinicWithClient(
    supabase as PlatformAdminFunctionClient | null,
    input,
    context,
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

export async function rejectPaymentSubmission(
  input: RejectPaymentSubmissionInput,
): Promise<PlatformSubscriptionActionResult> {
  return invokeSubscriptionAction(
    'reject-subscription-payment-submission',
    input,
  )
}

export async function resendPlatformClinicInvitation(
  clinicId: string,
): Promise<ResendPlatformClinicInvitationServiceResult> {
  return resendPlatformClinicInvitationWithClient(
    supabase as PlatformAdminFunctionClient | null,
    clinicId,
  )
}

export async function correctPlatformClinicOwnerEmail(
  input: CorrectPlatformClinicOwnerEmailInput,
): Promise<CorrectPlatformClinicOwnerEmailServiceResult> {
  return correctPlatformClinicOwnerEmailWithClient(
    supabase as PlatformAdminFunctionClient | null,
    input,
  )
}

export async function createPlatformClinicWithClient(
  client: PlatformAdminFunctionClient | null,
  input: CreatePlatformClinicInput,
  performanceContext?: PerformanceOperationContext,
): Promise<CreatePlatformClinicServiceResult> {
  const instrumentation =
    performanceContext?.instrumentation ?? clientPerformanceInstrumentation
  const operationId = performanceContext?.operationId
  const startedAt = instrumentation.now()
  let sessionMs = 0
  let functionInvokeMs = 0

  const complete = (
    result: CreatePlatformClinicServiceResult,
    outcome: 'error' | 'success',
  ) => {
    if (operationId) {
      instrumentation.record(
        createClientPerformanceEvent({
          operation: 'create_platform_clinic_request',
          operationId,
          outcome,
          phases: {
            function_invoke: functionInvokeMs,
            session: sessionMs,
          },
          totalMs: elapsedMilliseconds(startedAt, instrumentation.now()),
        }),
      )
    }

    return result
  }

  if (!client) {
    return complete(
      { data: null, error: 'Supabase no está configurado.' },
      'error',
    )
  }

  const sessionStartedAt = instrumentation.now()
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  sessionMs = elapsedMilliseconds(sessionStartedAt, instrumentation.now())
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return complete(
      {
        data: null,
        error: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
      },
      'error',
    )
  }

  const functionStartedAt = instrumentation.now()
  let invocationResult: Awaited<
    ReturnType<PlatformAdminFunctionClient['functions']['invoke']>
  >

  try {
    invocationResult = await client.functions.invoke(
      'create-platform-clinic',
      {
        body: input,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(operationId
            ? { 'X-Dayia-Operation-Id': operationId }
            : {}),
        },
        method: 'POST',
      },
    )
  } catch (error) {
    functionInvokeMs = elapsedMilliseconds(
      functionStartedAt,
      instrumentation.now(),
    )
    complete(
      { data: null, error: 'No pudimos preparar el consultorio.' },
      'error',
    )
    throw error
  }

  functionInvokeMs = elapsedMilliseconds(
    functionStartedAt,
    instrumentation.now(),
  )
  const { data, error } = invocationResult

  if (error) {
    return complete(
      { data: null, error: await getCreateClinicErrorMessage(error) },
      'error',
    )
  }

  if (!isCreatePlatformClinicResponse(data)) {
    return complete(
      { data: null, error: 'No pudimos preparar el consultorio.' },
      'error',
    )
  }

  return complete({ data, error: null }, 'success')
}

export async function listPlatformClinicsWithClient(
  client: PlatformAdminFunctionClient | null,
  input: ListPlatformClinicsInput = {},
): Promise<PlatformAdminServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
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
        body: input,
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
      data: {
        clinics: data.clinics.map(mapPlatformClinicListItem),
        pageInfo: data.pageInfo,
      },
      error: null,
    }
  } catch {
    return {
      data: null,
      error:
        'No pudimos comunicarnos con el servicio de consultorios. Intenta nuevamente.',
    }
  }
}

export async function getPlatformClinicBillingWithClient(
  client: PlatformAdminFunctionClient | null,
  input: GetPlatformClinicBillingInput,
): Promise<PlatformClinicBillingServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
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
      'get-platform-clinic-billing',
      {
        body: input,
        headers: { Authorization: `Bearer ${accessToken}` },
        method: 'POST',
      },
    )

    if (error) {
      return { data: null, error: getPlatformBillingErrorMessage(error) }
    }

    if (!isGetPlatformClinicBillingResponse(data)) {
      return {
        data: null,
        error: 'No pudimos cargar la gestión del consultorio.',
      }
    }

    return {
      data: {
        clinic: mapPlatformClinicSummary(data.clinic),
        paymentPageInfo: data.paymentPageInfo,
        submissionPageInfo: data.submissionPageInfo,
      },
      error: null,
    }
  } catch {
    return {
      data: null,
      error:
        'No pudimos comunicarnos con la gestión del consultorio. Intenta nuevamente.',
    }
  }
}

export function mapPlatformClinicListItem(
  clinic: PlatformClinicListItem,
): PlatformClinicListItem {
  return {
    activeMembersCount: Number.isFinite(clinic.activeMembersCount)
      ? Math.max(0, clinic.activeMembersCount)
      : 0,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName.trim() || 'Consultorio sin nombre',
    clinicStatus:
      clinic.clinicStatus && clinicStatuses.has(clinic.clinicStatus)
        ? clinic.clinicStatus
        : 'unknown',
    createdAt: clinic.createdAt,
    ownerEmail: clinic.ownerEmail?.trim() || null,
    ownerInvitationSentAt: clinic.ownerInvitationSentAt ?? null,
    ownerMembershipStatus:
      clinic.ownerMembershipStatus &&
      ownerMembershipStatuses.has(clinic.ownerMembershipStatus)
        ? clinic.ownerMembershipStatus
        : null,
    ownerName: clinic.ownerName?.trim() || null,
    pendingPaymentSubmissionsCount: Number.isFinite(
      clinic.pendingPaymentSubmissionsCount,
    )
      ? Math.max(0, clinic.pendingPaymentSubmissionsCount)
      : 0,
    planId: clinic.planId?.trim() || null,
    planName: getPlatformPlanName(clinic.planId, clinic.planName),
    subscriptionStatus: normalizePlatformSubscriptionStatus(
      clinic.subscriptionStatus,
    ),
  }
}

export async function resendPlatformClinicInvitationWithClient(
  client: PlatformAdminFunctionClient | null,
  clinicId: string,
): Promise<ResendPlatformClinicInvitationServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
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
      'resend-platform-clinic-invitation',
      {
        body: { clinicId },
        headers: { Authorization: `Bearer ${accessToken}` },
        method: 'POST',
      },
    )

    if (error) {
      return {
        data: null,
        error: await getResendInvitationErrorMessage(error),
      }
    }

    if (!isResendInvitationResponse(data)) {
      return {
        data: null,
        error: 'No pudimos confirmar el reenvío de la invitación.',
      }
    }

    return { data, error: null }
  } catch {
    return {
      data: null,
      error:
        'No pudimos comunicarnos con el servicio de invitaciones. Intenta nuevamente.',
    }
  }
}

export async function correctPlatformClinicOwnerEmailWithClient(
  client: PlatformAdminFunctionClient | null,
  input: CorrectPlatformClinicOwnerEmailInput,
): Promise<CorrectPlatformClinicOwnerEmailServiceResult> {
  if (!client) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
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
      'correct-platform-clinic-owner-email',
      {
        body: input,
        headers: { Authorization: `Bearer ${accessToken}` },
        method: 'POST',
      },
    )

    if (error) {
      return {
        data: null,
        error: await getCorrectOwnerEmailErrorMessage(error),
      }
    }

    if (!isResendInvitationResponse(data)) {
      return {
        data: null,
        error: 'No pudimos confirmar la corrección del correo.',
      }
    }

    return { data, error: null }
  } catch {
    return {
      data: null,
      error:
        'No pudimos comunicarnos con el servicio de invitaciones. Intenta nuevamente.',
    }
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
    latestRegisteredPaymentId: clinic.latestRegisteredPaymentId ?? null,
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
    ownerInvitationSentAt: clinic.ownerInvitationSentAt ?? null,
    ownerMembershipStatus:
      clinic.ownerMembershipStatus &&
      ownerMembershipStatuses.has(clinic.ownerMembershipStatus)
        ? clinic.ownerMembershipStatus
        : null,
    ownerName: clinic.ownerName?.trim() || null,
    pendingPaymentSubmissionsCount: Number.isFinite(
      clinic.pendingPaymentSubmissionsCount,
    )
      ? Math.max(0, clinic.pendingPaymentSubmissionsCount)
      : 0,
    planId: clinic.planId?.trim() || null,
    planName: getPlatformPlanName(clinic.planId, clinic.planName),
    paymentStatus: clinic.paymentStatus?.trim() || null,
    payments: Array.isArray(clinic.payments) ? clinic.payments : [],
    paymentSubmissions: Array.isArray(clinic.paymentSubmissions)
      ? clinic.paymentSubmissions
      : [],
    registeredLifetimePayment: clinic.registeredLifetimePayment ?? null,
    subscriptionStatus: getEffectiveSubscriptionStatus(clinic),
    trialEndsAt: clinic.trialEndsAt ?? null,
  }
}

function getEffectiveSubscriptionStatus(
  clinic: PlatformClinicSummary,
): PlatformSubscriptionStatus | null {
  const normalizedStatus = normalizePlatformSubscriptionStatus(
    clinic.subscriptionStatus,
  )

  if (normalizedStatus === 'canceled' || normalizedStatus === 'blocked') {
    return normalizedStatus
  }
  if (clinic.isLifetime || normalizedStatus === 'lifetime') return 'lifetime'
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

function normalizePlatformSubscriptionStatus(
  status: PlatformSubscriptionStatus | null,
): PlatformSubscriptionStatus | null {
  return status && subscriptionStatuses.has(status)
    ? status
    : status === null
      ? null
      : 'unknown'
}

async function invokeSubscriptionAction(
  functionName:
    | 'register-subscription-payment'
    | 'reject-subscription-payment-submission'
    | 'update-clinic-subscription'
    | 'void-subscription-payment',
  body:
    | RegisterSubscriptionPaymentInput
    | RejectPaymentSubmissionInput
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
    | 'reject-subscription-payment-submission'
    | 'update-clinic-subscription'
    | 'void-subscription-payment',
  body:
    | RegisterSubscriptionPaymentInput
    | RejectPaymentSubmissionInput
    | UpdateClinicSubscriptionInput
    | VoidSubscriptionPaymentInput,
): Promise<PlatformSubscriptionActionResult> {

  if (!client) return { error: 'Supabase no está configurado.', success: false }

  try {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession()
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
      return {
        error: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
        success: false,
      }
    }
    if (status === 403) {
      return {
        error: 'No tienes permiso para administrar suscripciones.',
        success: false,
      }
    }
    if (status === 404) {
      const responseError = await getFunctionResponseError(error)
      return {
        error: responseError?.message ?? 'No encontramos la solicitud.',
        success: false,
      }
    }
    if (status === 409) {
      const responseError = await getFunctionResponseError(error)
      return {
        error:
          responseError?.message ??
          'El cambio solicitado entra en conflicto con la suscripción actual.',
        success: false,
      }
    }

    return {
      error: 'No pudimos actualizar la suscripción. Intenta nuevamente.',
      success: false,
    }
  } catch {
    return {
      error:
        'No pudimos comunicarnos con el servicio de suscripciones. Intenta nuevamente.',
      success: false,
    }
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

function getPlatformBillingErrorMessage(error: unknown) {
  const status = getFunctionErrorStatus(error)

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para administrar suscripciones.'
  }

  if (status === 404) {
    return 'No encontramos el consultorio solicitado.'
  }

  return 'No pudimos cargar la gestión del consultorio.'
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
      [
        'CLINIC_ALREADY_EXISTS',
        'CLINIC_CREATION_IN_PROGRESS',
        'OWNER_EMAIL_ALREADY_REGISTERED',
        'OWNER_EMAIL_CREATION_IN_PROGRESS',
        'FOUNDER_PRICE_NOT_CONFIGURED',
        'REQUEST_PAYLOAD_MISMATCH',
      ].includes(responseError?.code ?? '') &&
      responseError?.message
    ) {
      return responseError.message
    }

    return 'No pudimos crear el consultorio por un conflicto.'
  }

  if (status === 429 && responseError?.message) {
    return responseError.message
  }

  if (status === 503 && responseError?.message) {
    return responseError.message
  }

  return 'No pudimos preparar el consultorio. Intenta nuevamente.'
}

async function getResendInvitationErrorMessage(error: unknown) {
  const status = getFunctionErrorStatus(error)
  const responseError = await getFunctionResponseError(error)

  if (status === 400) {
    return 'No pudimos identificar el consultorio.'
  }

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para reenviar invitaciones.'
  }

  if (status === 404) {
    return responseError?.message ?? 'No encontramos la invitación pendiente.'
  }

  if (status === 409) {
    return (
      responseError?.message ??
      'La cuenta propietaria ya no admite una nueva invitación.'
    )
  }

  if (status === 429) {
    return (
      responseError?.message ??
      'Espera un momento antes de reenviar otra invitación.'
    )
  }

  return 'No pudimos reenviar la invitación. Intenta nuevamente.'
}

async function getCorrectOwnerEmailErrorMessage(error: unknown) {
  const status = getFunctionErrorStatus(error)
  const responseError = await getFunctionResponseError(error)

  if (status === 400) {
    return responseError?.message ?? 'Ingresa un email válido.'
  }

  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }

  if (status === 403) {
    return 'No tienes permiso para corregir propietarios.'
  }

  if (status === 404 || status === 409 || status === 429) {
    return (
      responseError?.message ??
      'No pudimos corregir el correo del propietario.'
    )
  }

  return 'No pudimos corregir el correo del propietario. Intenta nuevamente.'
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
      (candidate.clinic.clinicStatus === 'pending_activation' ||
        candidate.clinic.clinicStatus === 'active') &&
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
      Array.isArray((value as ListPlatformClinicsResponse).clinics) &&
      isPageInfo(
        (value as ListPlatformClinicsResponse).pageInfo,
        isClinicCursor,
      ),
  )
}

function isGetPlatformClinicBillingResponse(
  value: unknown,
): value is GetPlatformClinicBillingResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<GetPlatformClinicBillingResponse>

  return Boolean(
    candidate.clinic &&
      typeof candidate.clinic.clinicId === 'string' &&
      Array.isArray(candidate.clinic.payments) &&
      Array.isArray(candidate.clinic.paymentSubmissions) &&
      isPageInfo(candidate.paymentPageInfo, isPaymentCursor) &&
      isPageInfo(candidate.submissionPageInfo, isClinicCursor),
  )
}

function isPageInfo<Cursor>(
  value: unknown,
  isCursor: (cursor: unknown) => cursor is Cursor,
): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as {
    hasNextPage?: unknown
    limit?: unknown
    nextCursor?: unknown
    totalCount?: unknown
  }

  return (
    typeof candidate.hasNextPage === 'boolean' &&
    Number.isInteger(candidate.limit) &&
    Number(candidate.limit) > 0 &&
    Number.isInteger(candidate.totalCount) &&
    Number(candidate.totalCount) >= 0 &&
    (
      candidate.nextCursor === null ||
      isCursor(candidate.nextCursor)
    )
  )
}

function isClinicCursor(value: unknown): value is {
  createdAt: string
  id: string
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { createdAt?: unknown; id?: unknown }
  return (
    typeof candidate.createdAt === 'string' &&
    typeof candidate.id === 'string'
  )
}

function isPaymentCursor(value: unknown): value is {
  createdAt: string
  id: string
  paidAt: string
} {
  return (
    isClinicCursor(value) &&
    typeof (value as { paidAt?: unknown }).paidAt === 'string'
  )
}

function isResendInvitationResponse(
  value: unknown,
): value is ResendPlatformClinicInvitationResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ResendPlatformClinicInvitationResponse>
  return (
    typeof candidate.email === 'string' &&
    candidate.email.includes('@') &&
    typeof candidate.sentAt === 'string'
  )
}
