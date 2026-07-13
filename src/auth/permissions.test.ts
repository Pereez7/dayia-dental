import { describe, expect, it } from 'vitest'

import {
  canAccessPlatformAdministration,
  canManageClinicSettings,
  canManageUsers,
  canManageWhatsapp,
  canViewClinicalRecords,
  getUserRoleLabel,
  normalizeUserRole,
} from './permissions'

describe('auth permissions', () => {
  it('limits DayIA administration to platform administrators', () => {
    expect(
      canAccessPlatformAdministration({
        is_platform_admin: true,
        role: 'clinic_owner',
      }),
    ).toBe(true)
    expect(
      canAccessPlatformAdministration({
        is_platform_admin: false,
        role: 'platform_admin',
      }),
    ).toBe(true)
    expect(
      canAccessPlatformAdministration({
        is_platform_admin: false,
        role: 'clinic_admin',
      }),
    ).toBe(false)
  })

  it('normalizes legacy roles to the current MVP roles', () => {
    expect(normalizeUserRole('owner')).toBe('clinic_owner')
    expect(normalizeUserRole('admin')).toBe('clinic_admin')
    expect(normalizeUserRole('dentist')).toBe('doctor')
    expect(normalizeUserRole('reception')).toBe('receptionist')
    expect(normalizeUserRole('super_admin')).toBe('platform_admin')
  })

  it('allows only admin roles to manage sensitive clinic areas', () => {
    expect(canManageClinicSettings('clinic_owner')).toBe(true)
    expect(canManageClinicSettings('clinic_admin')).toBe(true)
    expect(canManageUsers('clinic_admin')).toBe(true)
    expect(canManageUsers('platform_admin')).toBe(true)
    expect(canManageUsers('doctor')).toBe(false)
    expect(canManageUsers('receptionist')).toBe(false)
    expect(canManageWhatsapp('doctor')).toBe(false)
    expect(canManageClinicSettings('receptionist')).toBe(false)
  })

  it('uses admin-only permission for user creation and invitation resend', () => {
    expect(canManageUsers('clinic_owner')).toBe(true)
    expect(canManageUsers('clinic_admin')).toBe(true)
    expect(canManageUsers('platform_admin')).toBe(true)
    expect(canManageUsers('doctor')).toBe(false)
    expect(canManageUsers('receptionist')).toBe(false)
  })

  it('keeps clinical records visible to admins and doctors', () => {
    expect(canViewClinicalRecords('clinic_owner')).toBe(true)
    expect(canViewClinicalRecords('clinic_admin')).toBe(true)
    expect(canViewClinicalRecords('doctor')).toBe(true)
    expect(canViewClinicalRecords('receptionist')).toBe(false)
  })

  it('returns readable role labels', () => {
    expect(getUserRoleLabel('owner')).toBe('Propietario del consultorio')
    expect(getUserRoleLabel('admin')).toBe('Administrador del consultorio')
    expect(getUserRoleLabel('receptionist')).toBe('Recepcionista')
    expect(getUserRoleLabel('super_admin')).toBe('Administrador del consultorio')
  })
})
