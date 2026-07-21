import { describe, expect, it } from 'vitest'

import type { ClinicSubscriptionRecord } from '../types/database'
import { getSubscriptionScopedPermissions } from './subscriptionPermissions'

function subscription(
  overrides: Partial<ClinicSubscriptionRecord> = {},
): ClinicSubscriptionRecord {
  return {
    billing_cycle: 'monthly',
    blocked_at: null,
    clinic_id: 'clinic-1',
    created_at: '2026-07-01T00:00:00.000Z',
    current_period_ends_at: '2020-01-01T00:00:00.000Z',
    current_period_starts_at: '2019-12-01T00:00:00.000Z',
    ends_at: '2020-01-01T00:00:00.000Z',
    grace_ends_at: '2020-01-06T00:00:00.000Z',
    id: 'subscription-1',
    is_lifetime: false,
    last_payment_at: null,
    payment_status: 'past_due',
    plan_id: 'pro',
    starts_at: '2019-12-01T00:00:00.000Z',
    status: 'past_due',
    trial_ends_at: null,
    trial_starts_at: null,
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('subscription scoped permissions', () => {
  it('keeps the authenticated context but disables every clinical loader when blocked', () => {
    const result = getSubscriptionScopedPermissions({
      isDemoMode: false,
      isPlatformAdmin: false,
      planId: 'pro',
      role: 'clinic_owner',
      subscription: subscription(),
    })

    expect(result.isBlocked).toBe(true)
    expect(Object.values(result.permissions).every((permission) => !permission)).toBe(true)
  })

  it('keeps clinical access during grace and forever for lifetime', () => {
    const grace = getSubscriptionScopedPermissions({
      isDemoMode: false,
      isPlatformAdmin: false,
      planId: 'pro',
      role: 'clinic_owner',
      subscription: subscription({
        current_period_ends_at: '2999-01-01T00:00:00.000Z',
        grace_ends_at: '2999-01-06T00:00:00.000Z',
      }),
    })
    const lifetime = getSubscriptionScopedPermissions({
      isDemoMode: false,
      isPlatformAdmin: false,
      planId: 'pro',
      role: 'clinic_owner',
      subscription: subscription({ is_lifetime: true, status: 'lifetime' }),
    })

    expect(grace.permissions.canAccessPatients).toBe(true)
    expect(lifetime.permissions.canAccessPatients).toBe(true)
    expect(lifetime.access.notice).toBeNull()
  })
})
