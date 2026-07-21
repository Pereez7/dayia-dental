import { describe, expect, it } from 'vitest'

import {
  calculatePaymentRegistration,
  calculateExtraDaysPeriod,
  assertPlatformBillingAdmin,
  normalizeRegisterPaymentPayload,
} from './subscriptionBilling.ts'

const input = normalizeRegisterPaymentPayload({
  amountPaid: 540,
  billingCycle: 'six_months',
  clinicId: '11111111-1111-4111-8111-111111111111',
  discountPercent: 10,
  paidAt: '2026-08-10T12:00:00.000Z',
  planId: 'basic',
})

describe('subscriptionBilling edge helpers', () => {
  it('allows only platform administrators to manage billing', () => {
    expect(() => assertPlatformBillingAdmin(false)).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
    )
    expect(() => assertPlatformBillingAdmin(true)).not.toThrow()
  })
  it('normalizes periods and calculates the configured discount', () => {
    expect(input.monthsCovered).toBe(6)
    expect(
      calculatePaymentRegistration({
        currentPeriodEndsAt: '2026-08-20T12:00:00.000Z',
        input,
        monthlyPrice: 100,
        now: new Date('2026-08-10T12:00:00.000Z'),
      }),
    ).toMatchObject({
      amountDue: 600,
      amountPaid: 540,
      discountAmount: 60,
      periodEndsAt: '2027-02-20T12:00:00.000Z',
    })
  })

  it('creates lifetime access without an end or grace date', () => {
    const lifetime = normalizeRegisterPaymentPayload({
      amountPaid: 3000,
      billingCycle: 'lifetime',
      clinicId: '11111111-1111-4111-8111-111111111111',
      discountPercent: 0,
      isLifetime: true,
      planId: 'pro',
    })

    expect(
      calculatePaymentRegistration({
        currentPeriodEndsAt: null,
        input: lifetime,
        monthlyPrice: null,
      }),
    ).toMatchObject({ graceEndsAt: null, periodEndsAt: null })
  })

  it('adds administrative days from the current end', () => {
    expect(
      calculateExtraDaysPeriod(
        '2026-08-20T12:00:00.000Z',
        10,
        new Date('2026-08-10T12:00:00.000Z'),
      ),
    ).toEqual({
      graceEndsAt: '2026-09-04T12:00:00.000Z',
      periodEndsAt: '2026-08-30T12:00:00.000Z',
    })
  })
})
