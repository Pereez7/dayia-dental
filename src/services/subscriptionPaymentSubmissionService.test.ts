import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: clientMocks.getSession },
    functions: { invoke: clientMocks.invoke },
  },
}))

import {
  isWhatsappPaymentNoticeReference,
  scheduleSubscriptionDowngrade,
  submitSubscriptionPaymentNotice,
} from './subscriptionPaymentSubmissionService'

describe('subscription payment submission service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clientMocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'owner-token' } },
      error: null,
    })
    clientMocks.invoke.mockResolvedValue({
      data: {
        alreadyPending: false,
        amountExpected: 249,
        id: 'notice-1',
        paymentType: 'regular',
        planId: 'pro',
        success: true,
      },
      error: null,
    })
  })

  it('asks the secure function to calculate and create the payment notice', async () => {
    const result = await submitSubscriptionPaymentNotice({
      billingCycle: 'monthly',
      clinicId: 'clinic-1',
      planId: 'pro',
    })

    expect(clientMocks.invoke).toHaveBeenCalledWith(
      'manage-owner-subscription-plan',
      {
        body: {
          action: 'submit_payment_notice',
          billingCycle: 'monthly',
          clinicId: 'clinic-1',
          planId: 'pro',
        },
        headers: { Authorization: 'Bearer owner-token' },
        method: 'POST',
      },
    )
    expect(result).toEqual({
      data: expect.objectContaining({
        amountExpected: 249,
        id: 'notice-1',
        success: true,
      }),
      error: null,
    })
  })

  it('schedules downgrades without creating a payment in the browser', async () => {
    clientMocks.invoke.mockResolvedValue({
      data: {
        effectiveAt: '2026-09-21T00:00:00.000Z',
        planId: 'medium',
        success: true,
      },
      error: null,
    })

    await scheduleSubscriptionDowngrade({
      clinicId: 'clinic-1',
      planId: 'medium',
    })

    expect(clientMocks.invoke).toHaveBeenCalledWith(
      'manage-owner-subscription-plan',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'schedule_downgrade',
          planId: 'medium',
        }),
      }),
    )
  })

  it('does not call the function without a valid session', async () => {
    clientMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const result = await submitSubscriptionPaymentNotice({
      billingCycle: 'monthly',
      clinicId: 'clinic-1',
      planId: 'pro',
    })

    expect(clientMocks.invoke).not.toHaveBeenCalled()
    expect(result.error).toContain('sesión')
  })

  it('identifies the internal WhatsApp marker so it is not treated as a bank reference', () => {
    expect(isWhatsappPaymentNoticeReference(' DAYIA-WHATSAPP ')).toBe(true)
    expect(isWhatsappPaymentNoticeReference('012')).toBe(false)
  })
})
