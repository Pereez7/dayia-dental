import { describe, expect, it } from 'vitest'

import {
  calculatePaymentRegistration,
  calculateExtraDaysPeriod,
  assertPlatformBillingAdmin,
  normalizeRegisterPaymentPayload,
  calculateUpgradeProration,
  getEffectiveMonthlyPrice,
  getPlanChangeKind,
  getScheduledDowngradeUpdate,
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

  it('uses the subscription price tier independently of the QR', () => {
    expect(getEffectiveMonthlyPrice({ standardPrice: 199, founderPrice: 129, customPrice: null, priceTier: 'founder' })).toBe(129)
    expect(getEffectiveMonthlyPrice({ standardPrice: 199, founderPrice: 129, customPrice: 175, priceTier: 'custom' })).toBe(175)
    expect(getEffectiveMonthlyPrice({ standardPrice: 199, founderPrice: 129, customPrice: null, priceTier: 'standard' })).toBe(199)
  })

  it('calculates an immediate upgrade without extending the period', () => {
    expect(calculateUpgradeProration({
      currentMonthlyPrice: 129,
      newMonthlyPrice: 199,
      currentPeriodEndsAt: '2026-08-09T00:00:00.000Z',
      now: new Date('2026-07-20T00:00:00.000Z'),
    })).toEqual({ amount: 46.67, daysRemaining: 20 })
    expect(getPlanChangeKind('basic', 'medium')).toBe('upgrade')
    expect(getPlanChangeKind('pro', 'basic')).toBe('downgrade')
    expect(getScheduledDowngradeUpdate('2026-08-09T00:00:00.000Z', 'basic')).toEqual({
      scheduled_plan_id: 'basic',
      scheduled_plan_starts_at: '2026-08-09T00:00:00.000Z',
    })
  })
})
