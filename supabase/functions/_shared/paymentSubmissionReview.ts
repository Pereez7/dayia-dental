export interface RejectPaymentSubmissionInput {
  reason: string
  submissionId: string
}

export class PaymentSubmissionReviewError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'PaymentSubmissionReviewError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeRejectPaymentSubmissionPayload(
  payload: unknown,
): RejectPaymentSubmissionInput {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalid('Revisa los datos del rechazo.')
  }

  const value = payload as Record<string, unknown>
  const submissionId =
    typeof value.submissionId === 'string' ? value.submissionId.trim() : ''
  const reason = typeof value.reason === 'string' ? value.reason.trim() : ''

  if (!uuidPattern.test(submissionId)) {
    throw invalid('Selecciona una solicitud válida.')
  }

  if (reason.length < 5 || reason.length > 500) {
    throw invalid(
      'Explica el motivo del rechazo con entre 5 y 500 caracteres.',
    )
  }

  return { reason, submissionId }
}

function invalid(message: string) {
  return new PaymentSubmissionReviewError(
    'INVALID_PAYMENT_SUBMISSION_REJECTION',
    message,
    400,
  )
}
