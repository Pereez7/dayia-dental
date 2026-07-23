import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const limit = vi.fn()
  const statusEq = vi.fn(() => ({ limit }))
  const clinicEq = vi.fn(() => ({ eq: statusEq }))
  const selectPending = vi.fn(() => ({ eq: clinicEq }))
  const single = vi.fn()
  const selectInserted = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: selectInserted }))
  const from = vi.fn(() => ({
    insert,
    select: selectPending,
  }))

  return {
    clinicEq,
    from,
    insert,
    limit,
    selectInserted,
    selectPending,
    single,
    statusEq,
  }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from },
}))

import {
  isWhatsappPaymentNoticeReference,
  submitSubscriptionPaymentNotice,
  whatsappPaymentNoticeReference,
} from './subscriptionPaymentSubmissionService'

const input = {
  amountExpected: 249,
  billingCycle: 'monthly' as const,
  clinicId: 'clinic-1',
  currency: 'BOB',
  planId: 'pro',
  submittedBy: 'owner-1',
}

describe('subscription payment submission service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.limit.mockResolvedValue({ data: [], error: null })
    queryMocks.single.mockResolvedValue({
      data: { id: 'notice-1' },
      error: null,
    })
  })

  it('creates a pending administrative notice without asking for a bank reference', async () => {
    const result = await submitSubscriptionPaymentNotice(input)

    expect(queryMocks.from).toHaveBeenCalledWith(
      'subscription_payment_submissions',
    )
    expect(queryMocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_expected: 249,
        billing_cycle: 'monthly',
        clinic_id: 'clinic-1',
        plan_id: 'pro',
        reference: whatsappPaymentNoticeReference,
        status: 'pending_review',
        submitted_by: 'owner-1',
      }),
    )
    expect(result).toEqual({
      data: { alreadyPending: false, id: 'notice-1' },
      error: null,
    })
  })

  it('reuses an existing pending notice instead of creating duplicates', async () => {
    queryMocks.limit.mockResolvedValue({
      data: [{ id: 'notice-existing' }],
      error: null,
    })

    const result = await submitSubscriptionPaymentNotice(input)

    expect(queryMocks.insert).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: { alreadyPending: true, id: 'notice-existing' },
      error: null,
    })
  })

  it('identifies the internal WhatsApp marker so it is not treated as a bank reference', () => {
    expect(isWhatsappPaymentNoticeReference(' DAYIA-WHATSAPP ')).toBe(true)
    expect(isWhatsappPaymentNoticeReference('012')).toBe(false)
  })
})
