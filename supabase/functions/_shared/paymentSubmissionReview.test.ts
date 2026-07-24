import { describe, expect, it } from 'vitest'

import {
  normalizeRejectPaymentSubmissionPayload,
  PaymentSubmissionReviewError,
} from './paymentSubmissionReview.ts'

describe('payment submission review helpers', () => {
  it('normalizes a valid rejection', () => {
    expect(
      normalizeRejectPaymentSubmissionPayload({
        reason: '  El importe no coincide con el comprobante.  ',
        submissionId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      reason: 'El importe no coincide con el comprobante.',
      submissionId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it.each([
    [null],
    [{ reason: 'No', submissionId: '11111111-1111-4111-8111-111111111111' }],
    [{ reason: 'Referencia inválida', submissionId: 'not-a-uuid' }],
  ])('rejects an invalid payload %#', (payload) => {
    expect(() =>
      normalizeRejectPaymentSubmissionPayload(payload),
    ).toThrowError(PaymentSubmissionReviewError)
  })
})
