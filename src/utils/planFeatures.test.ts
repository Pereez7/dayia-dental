import { describe, expect, it } from 'vitest'

import {
  canAccessFeature,
  canManageTeam,
  getPlanFeatures,
  getVisibleClinicRoleLabel,
  isWithinUserLimit,
} from './planFeatures'

describe('plan features and clinic roles', () => {
  it('keeps a clinic owner on basic without team management', () => {
    const basic = getPlanFeatures('basic')

    expect(basic.maxUsers).toBe(1)
    expect(canManageTeam('clinic_owner', basic)).toBe(false)
    expect(canAccessFeature(basic, 'manageTeam')).toBe(false)
  })

  it('allows a clinic owner on medium to manage the team', () => {
    const medium = getPlanFeatures('medium')

    expect(medium.maxUsers).toBe(4)
    expect(canManageTeam('clinic_owner', medium)).toBe(true)
    expect(canAccessFeature(medium, 'manageTeam')).toBe(true)
  })

  it('blocks doctors and receptionists from team management', () => {
    const pro = getPlanFeatures('pro')

    expect(canManageTeam('doctor', pro)).toBe(false)
    expect(canManageTeam('receptionist', pro)).toBe(false)
  })

  it('checks user limits by plan', () => {
    const medium = getPlanFeatures('medium')

    expect(isWithinUserLimit(3, medium)).toBe(true)
    expect(isWithinUserLimit(4, medium)).toBe(false)
  })

  it('uses clinical labels and never exposes platform admin in clinic UI', () => {
    expect(getVisibleClinicRoleLabel('clinic_owner')).toBe(
      'Propietario del consultorio',
    )
    expect(getVisibleClinicRoleLabel('clinic_admin')).toBe(
      'Administrador del consultorio',
    )
    expect(getVisibleClinicRoleLabel('super_admin')).toBe(
      'Administrador del consultorio',
    )
    expect(getVisibleClinicRoleLabel('platform_admin')).toBe(
      'Administrador del consultorio',
    )
  })

  it('falls back to basic for unknown plan ids', () => {
    expect(getPlanFeatures('legacy').id).toBe('basic')
  })
})
