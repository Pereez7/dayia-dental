import { describe, expect, it } from 'vitest'

import {
  calculateNewSubscriptionPeriod,
  calculateSubscriptionPayment,
  getSubscriptionAccessState,
  getPlanQrPath,
  getMonthlyPriceForTier,
  getPlanChangeKind,
  calculateUpgradeProration,
} from './subscriptionBilling'

describe('subscriptionBilling', () => {
  it.each([
    ['monthly', 1, 0, 100],
    ['six_months', 6, 10, 540],
    ['annual', 12, 20, 960],
  ] as const)('calculates %s billing', (billingCycle, months, discount, paid) => {
    expect(
      calculateSubscriptionPayment({ billingCycle, monthlyPrice: 100 }),
    ).toMatchObject({
      amountPaid: paid,
      discountPercent: discount,
      monthsCovered: months,
    })
  })

  it('prorates custom days and accepts a manual lifetime amount', () => {
    expect(
      calculateSubscriptionPayment({
        billingCycle: 'custom_days',
        customDays: 15,
        monthlyPrice: 120,
      }).amountPaid,
    ).toBe(60)
    expect(
      calculateSubscriptionPayment({
        billingCycle: 'lifetime',
        manualAmount: 2500,
        monthlyPrice: 120,
      }).amountPaid,
    ).toBe(2500)
  })

  it('extends from the current end when paid early', () => {
    expect(
      calculateNewSubscriptionPeriod({
        billingCycle: 'monthly',
        currentPeriodEndsAt: '2026-08-20T12:00:00.000Z',
        now: new Date('2026-08-10T12:00:00.000Z'),
      }).periodEndsAt,
    ).toBe('2026-09-20T12:00:00.000Z')
  })

  it('extends from now when already expired', () => {
    expect(
      calculateNewSubscriptionPeriod({
        billingCycle: 'monthly',
        currentPeriodEndsAt: '2026-08-20T12:00:00.000Z',
        now: new Date('2026-08-25T12:00:00.000Z'),
      }).periodEndsAt,
    ).toBe('2026-09-25T12:00:00.000Z')
  })

  it('allows grace and blocks after grace without expiring the session', () => {
    const subscription = {
      currentPeriodEndsAt: '2026-08-20T12:00:00.000Z',
      graceEndsAt: '2026-08-25T12:00:00.000Z',
      isLifetime: false,
      status: 'active' as const,
      trialEndsAt: null,
    }

    expect(
      getSubscriptionAccessState(
        subscription,
        new Date('2026-08-23T12:00:00.000Z'),
      ).access,
    ).toBe('grace')
    expect(
      getSubscriptionAccessState(
        subscription,
        new Date('2026-08-26T12:00:00.000Z'),
      ).access,
    ).toBe('blocked')
  })

  it('shows a trial warning at five days and never expires lifetime access', () => {
    expect(
      getSubscriptionAccessState(
        {
          currentPeriodEndsAt: '2026-08-20T12:00:00.000Z',
          graceEndsAt: '2026-08-25T12:00:00.000Z',
          isLifetime: false,
          status: 'trialing',
          trialEndsAt: '2026-08-20T12:00:00.000Z',
        },
        new Date('2026-08-15T12:00:00.000Z'),
      ).notice,
    ).toBe('trial_ending')

    expect(
      getSubscriptionAccessState(
        {
          currentPeriodEndsAt: null,
          graceEndsAt: null,
          isLifetime: true,
          status: 'lifetime',
          trialEndsAt: null,
        },
        new Date('2036-08-15T12:00:00.000Z'),
      ),
    ).toEqual({ access: 'lifetime', daysRemaining: null, notice: null })
  })

  it('allows a manual administrative block on a lifetime license', () => {
    expect(
      getSubscriptionAccessState({
        currentPeriodEndsAt: null,
        graceEndsAt: null,
        isLifetime: true,
        status: 'blocked',
        trialEndsAt: null,
      }).access,
    ).toBe('blocked')
  })

  it('changes the static QR path with the selected plan', () => {
    expect(getPlanQrPath('basic')).toBe('/payment-qr/basic.png')
    expect(getPlanQrPath('medium')).toBe('/payment-qr/medium.png')
    expect(getPlanQrPath('pro')).toBe('/payment-qr/pro.png')
  })

  it('resolves standard, founder and custom prices without losing founder during grace', () => {
    expect(getMonthlyPriceForTier({ standardPrice: 199, founderPrice: 129, customPrice: null, priceTier: 'standard' })).toBe(199)
    expect(getMonthlyPriceForTier({ standardPrice: 199, founderPrice: 129, customPrice: null, priceTier: 'founder' })).toBe(129)
    expect(getMonthlyPriceForTier({ standardPrice: 199, founderPrice: 129, customPrice: 155, priceTier: 'custom' })).toBe(155)
  })

  it('calculates an upgrade proration and distinguishes a scheduled downgrade', () => {
    expect(calculateUpgradeProration({
      currentMonthlyPrice: 100,
      newMonthlyPrice: 160,
      currentPeriodEndsAt: '2026-08-04T00:00:00.000Z',
      now: new Date('2026-07-20T00:00:00.000Z'),
    })).toEqual({ amount: 30, daysRemaining: 15 })
    expect(getPlanChangeKind('basic', 'pro')).toBe('upgrade')
    expect(getPlanChangeKind('pro', 'medium')).toBe('downgrade')
  })
})
