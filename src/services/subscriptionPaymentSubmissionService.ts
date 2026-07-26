import { supabase } from '../lib/supabaseClient'
import type { PlatformClinicPlanId } from '../types/platform'
import type { BillingCycle, PaymentType } from '../utils/subscriptionBilling'

export const whatsappPaymentNoticeReference = 'dayia-whatsapp'

type RenewalBillingCycle = Extract<
  BillingCycle,
  'annual' | 'monthly' | 'six_months'
>

export interface OwnerPlanActionInput {
  action:
    | 'cancel_scheduled_downgrade'
    | 'schedule_downgrade'
    | 'submit_payment_notice'
  billingCycle?: RenewalBillingCycle
  clinicId: string
  planId?: PlatformClinicPlanId
}

export interface OwnerPlanActionData {
  alreadyPending?: boolean
  amountExpected?: number
  cancelledPlanId?: string
  effectiveAt?: string | null
  id?: string
  paymentType?: Extract<
    PaymentType,
    'reactivation_plan_change' | 'regular' | 'upgrade_proration'
  >
  planId?: string
  success: true
}

interface OwnerPlanFunctionClient {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null }
      error: unknown
    }>
  }
  functions: {
    invoke: (
      functionName: 'manage-owner-subscription-plan',
      options: {
        body: OwnerPlanActionInput
        headers: { Authorization: string }
        method: 'POST'
      },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

export async function submitSubscriptionPaymentNotice(
  input: Omit<OwnerPlanActionInput, 'action'>,
) {
  return manageOwnerSubscriptionPlan({
    ...input,
    action: 'submit_payment_notice',
  })
}

export async function scheduleSubscriptionDowngrade(
  input: Omit<OwnerPlanActionInput, 'action' | 'billingCycle'>,
) {
  return manageOwnerSubscriptionPlan({
    ...input,
    action: 'schedule_downgrade',
    billingCycle: 'monthly',
  })
}

export async function cancelScheduledSubscriptionDowngrade(
  clinicId: string,
) {
  return manageOwnerSubscriptionPlan({
    action: 'cancel_scheduled_downgrade',
    clinicId,
  })
}

export async function manageOwnerSubscriptionPlan(
  input: OwnerPlanActionInput,
) {
  return manageOwnerSubscriptionPlanWithClient(
    supabase as OwnerPlanFunctionClient | null,
    input,
  )
}

export async function manageOwnerSubscriptionPlanWithClient(
  client: OwnerPlanFunctionClient | null,
  input: OwnerPlanActionInput,
): Promise<{ data: OwnerPlanActionData | null; error: string | null }> {
  if (!client) {
    return {
      data: null,
      error: 'Supabase no está configurado.',
    }
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
      'manage-owner-subscription-plan',
      {
        body: input,
        headers: { Authorization: `Bearer ${accessToken}` },
        method: 'POST',
      },
    )

    if (error) {
      return {
        data: null,
        error: await getOwnerPlanActionError(error),
      }
    }
    if (!isOwnerPlanActionData(data)) {
      return {
        data: null,
        error: 'No pudimos confirmar el cambio de plan.',
      }
    }

    return { data, error: null }
  } catch {
    return {
      data: null,
      error:
        'No pudimos comunicarnos con el servicio de suscripciones. Intenta nuevamente.',
    }
  }
}

export function isWhatsappPaymentNoticeReference(
  reference: string | null | undefined,
) {
  return (
    reference?.trim().toLowerCase() === whatsappPaymentNoticeReference
  )
}

async function getOwnerPlanActionError(error: unknown) {
  const status = getFunctionErrorStatus(error)
  const responseError = await getFunctionResponseError(error)

  if (status === 400) {
    return responseError?.message ?? 'Revisa el plan y el periodo elegidos.'
  }
  if (status === 401) {
    return 'Tu sesión no es válida. Vuelve a iniciar sesión.'
  }
  if (status === 403) {
    return 'Solo el propietario puede gestionar el plan del consultorio.'
  }
  if (status === 409) {
    return (
      responseError?.message ??
      'El cambio solicitado ya no coincide con la suscripción actual.'
    )
  }

  return (
    responseError?.message ??
    'No pudimos avisar a Administración DayIA. Inténtalo nuevamente.'
  )
}

function isOwnerPlanActionData(
  value: unknown,
): value is OwnerPlanActionData {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { success?: unknown }).success === true
  )
}

function getFunctionErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return null
  }
  const context = (error as { context?: unknown }).context
  return context &&
    typeof context === 'object' &&
    'status' in context &&
    typeof context.status === 'number'
    ? context.status
    : null
}

async function getFunctionResponseError(
  error: unknown,
): Promise<{ message?: string } | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return null
  }
  const context = (error as { context?: unknown }).context
  if (!context || typeof context !== 'object') return null

  if ('json' in context && typeof context.json === 'function') {
    try {
      const payload = await (
        context as { json: () => Promise<unknown> }
      ).json()
      if (!payload || typeof payload !== 'object') return null
      const message = (payload as { message?: unknown; error?: unknown })
        .message
      const fallback = (payload as { error?: unknown }).error
      return {
        message:
          typeof message === 'string'
            ? message
            : typeof fallback === 'string'
              ? fallback
              : undefined,
      }
    } catch {
      return null
    }
  }

  return null
}
