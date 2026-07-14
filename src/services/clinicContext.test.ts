import { describe, expect, it } from 'vitest'

import { canAccessPlatformAdministration, canManageUsers } from '../auth/permissions'
import type {
  ClinicMembershipRecord,
  UserProfile,
} from '../types/database'
import { getPlanFeatures } from '../utils/planFeatures'
import {
  getSubscriptionPlanId,
  resolveProfileFromMembership,
  selectActiveClinicMembership,
} from './clinicContext'

const legacyAdminProfile: UserProfile = {
  clinic_id: 'legacy-clinic',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'cremacamba7@gmail.com',
  full_name: 'Dra. Vaca',
  id: 'user-1',
  is_platform_admin: false,
  role: 'clinic_admin',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('clinic session context', () => {
  it('prioritizes the active membership role over the legacy profile role', () => {
    const resolvedProfile = resolveProfileFromMembership(
      legacyAdminProfile,
      membership({ role: 'clinic_owner' }),
    )

    expect(resolvedProfile.role).toBe('clinic_owner')
    expect(resolvedProfile.clinic_id).toBe('membership-clinic')
    expect(canManageUsers(resolvedProfile.role)).toBe(true)
  })

  it('keeps the legacy role only when no active membership exists', () => {
    const resolvedProfile = resolveProfileFromMembership(
      legacyAdminProfile,
      null,
    )

    expect(resolvedProfile.role).toBe('clinic_admin')
    expect(resolvedProfile.clinic_id).toBe('legacy-clinic')
  })

  it('selects the most recently activated membership with a stable fallback', () => {
    const selected = selectActiveClinicMembership([
      membership({
        activated_at: '2026-06-01T00:00:00.000Z',
        id: 'older',
      }),
      membership({
        activated_at: '2026-07-01T00:00:00.000Z',
        id: 'newer',
        role: 'doctor',
      }),
      membership({ id: 'inactive', status: 'inactive' }),
    ])

    expect(selected?.id).toBe('newer')
    expect(selected?.role).toBe('doctor')
  })

  it('preserves platform access while resolving a clinical owner membership', () => {
    const resolvedProfile = resolveProfileFromMembership(
      { ...legacyAdminProfile, is_platform_admin: true },
      membership({ role: 'clinic_owner' }),
    )

    expect(resolvedProfile.role).toBe('clinic_owner')
    expect(canAccessPlatformAdministration(resolvedProfile)).toBe(true)
  })

  it('keeps a pure platform administrator authorized without a membership', () => {
    const resolvedProfile = resolveProfileFromMembership(
      {
        ...legacyAdminProfile,
        clinic_id: null,
        is_platform_admin: true,
        role: 'platform_admin',
      },
      null,
    )

    expect(resolvedProfile.clinic_id).toBeNull()
    expect(canAccessPlatformAdministration(resolvedProfile)).toBe(true)
  })

  it('does not grant legacy admin permissions over a doctor membership', () => {
    const resolvedProfile = resolveProfileFromMembership(
      legacyAdminProfile,
      membership({ role: 'doctor' }),
    )

    expect(resolvedProfile.role).toBe('doctor')
    expect(canManageUsers(resolvedProfile.role)).toBe(false)
  })

  it('uses the real subscription plan id', () => {
    expect(getSubscriptionPlanId({ plan_id: 'medium' })).toBe('medium')
    expect(getSubscriptionPlanId({ plan_id: 'pro' })).toBe('pro')
    expect(getPlanFeatures(getSubscriptionPlanId({ plan_id: 'medium' })).id).toBe(
      'medium',
    )
    expect(getPlanFeatures(getSubscriptionPlanId({ plan_id: 'pro' })).id).toBe(
      'pro',
    )
    expect(getSubscriptionPlanId(null)).toBeNull()
  })
})

function membership(
  overrides: Partial<ClinicMembershipRecord> = {},
): ClinicMembershipRecord {
  return {
    activated_at: '2026-06-01T00:00:00.000Z',
    clinic_id: 'membership-clinic',
    created_at: '2026-01-01T00:00:00.000Z',
    id: 'membership-1',
    invited_at: null,
    role: 'clinic_owner',
    status: 'active',
    updated_at: '2026-06-01T00:00:00.000Z',
    user_id: legacyAdminProfile.id,
    ...overrides,
  }
}
