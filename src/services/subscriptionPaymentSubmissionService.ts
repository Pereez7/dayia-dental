import { supabase } from '../lib/supabaseClient'
import type { BillingCycle } from '../utils/subscriptionBilling'

export const whatsappPaymentNoticeReference = 'dayia-whatsapp'

interface SubmitSubscriptionPaymentNoticeInput {
  amountExpected: number
  billingCycle: Extract<BillingCycle, 'annual' | 'monthly' | 'six_months'>
  clinicId: string
  currency: string
  planId: string
  submittedBy: string
}

interface PaymentNoticeRow {
  id: string
}

export async function submitSubscriptionPaymentNotice(
  input: SubmitSubscriptionPaymentNoticeInput,
) {
  if (!supabase) {
    return {
      data: null,
      error: 'No pudimos avisar a Administración DayIA.',
    }
  }

  const { data: pendingRows, error: pendingError } = await supabase
    .from('subscription_payment_submissions')
    .select('id')
    .eq('clinic_id', input.clinicId)
    .eq('status', 'pending_review')
    .limit(1)

  if (pendingError) {
    return {
      data: null,
      error: getPaymentNoticeErrorMessage(pendingError),
    }
  }

  const existingNotice = (pendingRows as PaymentNoticeRow[] | null)?.[0]

  if (existingNotice) {
    return {
      data: { alreadyPending: true, id: existingNotice.id },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('subscription_payment_submissions')
    .insert({
      amount_expected: input.amountExpected,
      billing_cycle: input.billingCycle,
      clinic_id: input.clinicId,
      currency: input.currency,
      notes: 'Comprobante enviado por WhatsApp para validación administrativa.',
      plan_id: input.planId,
      reference: whatsappPaymentNoticeReference,
      status: 'pending_review',
      submitted_by: input.submittedBy,
    } as never)
    .select('id')
    .single()

  if (error || !data) {
    if (getDatabaseErrorCode(error) === '23505') {
      return {
        data: { alreadyPending: true, id: '' },
        error: null,
      }
    }

    return {
      data: null,
      error: getPaymentNoticeErrorMessage(error),
    }
  }

  return {
    data: {
      alreadyPending: false,
      id: (data as PaymentNoticeRow).id,
    },
    error: null,
  }
}

export function isWhatsappPaymentNoticeReference(
  reference: string | null | undefined,
) {
  return reference?.trim().toLowerCase() === whatsappPaymentNoticeReference
}

export function getPaymentNoticeErrorMessage(error: unknown) {
  if (getDatabaseErrorCode(error) === '42501') {
    return 'No tienes permiso para informar pagos de este consultorio.'
  }

  return 'No pudimos avisar a Administración DayIA. Inténtalo nuevamente.'
}

function getDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null
  }

  return typeof error.code === 'string' ? error.code : null
}
