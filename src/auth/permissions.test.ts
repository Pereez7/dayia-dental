import { describe, expect, it } from 'vitest'

import {
  canAccessPlatformAdmin,
  canManageClinicUsers,
  canManageWhatsapp,
  getClinicalPermissions,
  getUserRoleLabel,
  normalizeUserRole,
} from './permissions'

describe('auth permissions', () => {
  it('keeps every canonical role unchanged', () => {
    expect(normalizeUserRole('clinic_owner')).toBe('clinic_owner')
    expect(normalizeUserRole('clinic_admin')).toBe('clinic_admin')
    expect(normalizeUserRole('doctor')).toBe('doctor')
    expect(normalizeUserRole('receptionist')).toBe('receptionist')
    expect(normalizeUserRole('platform_admin')).toBe('platform_admin')
  })

  it('maps only supported clinic legacy roles by default', () => {
    expect(normalizeUserRole('owner')).toBe('clinic_owner')
    expect(normalizeUserRole('admin')).toBe('clinic_admin')
  })

  it('maps super_admin only in a controlled legacy context', () => {
    expect(normalizeUserRole('super_admin')).toBe('unknown')
    expect(
      normalizeUserRole('super_admin', {
        allowLegacyPlatformAdmin: true,
      }),
    ).toBe('platform_admin')
  })

  it.each([null, '', 'unknown-role', 'clinic_owenr'])(
    'denies every clinical permission for invalid role %s',
    (role) => {
      expect(getClinicalPermissions(role, 'pro')).toEqual({
        canAccessAppointments: false,
        canAccessClinicalHistory: false,
        canAccessDashboard: false,
        canAccessOdontogram: false,
        canAccessPatients: false,
        canAccessReminders: false,
        canAccessSettings: false,
        canManageClinicUsers: false,
        canManageWhatsapp: false,
      })
    },
  )

  it('keeps explicit platform administrators authorized only for platform', () => {
    expect(canAccessPlatformAdmin({ is_platform_admin: true, role: null })).toBe(
      true,
    )
    expect(
      canAccessPlatformAdmin({
        is_platform_admin: false,
        role: 'platform_admin',
      }),
    ).toBe(true)
    expect(getClinicalPermissions('platform_admin', 'pro').canAccessDashboard).toBe(
      false,
    )
  })

  it('allows owner and admin to access every core clinical module', () => {
    for (const role of ['clinic_owner', 'clinic_admin']) {
      const permissions = getClinicalPermissions(role, 'basic')

      expect(permissions.canAccessDashboard).toBe(true)
      expect(permissions.canAccessPatients).toBe(true)
      expect(permissions.canAccessAppointments).toBe(true)
      expect(permissions.canAccessClinicalHistory).toBe(true)
      expect(permissions.canAccessOdontogram).toBe(true)
      expect(permissions.canAccessReminders).toBe(true)
      expect(permissions.canAccessSettings).toBe(true)
    }
  })

  it('limits doctors to clinical care without users, reminders or settings', () => {
    const permissions = getClinicalPermissions('doctor', 'pro')

    expect(permissions.canAccessDashboard).toBe(true)
    expect(permissions.canAccessPatients).toBe(true)
    expect(permissions.canAccessAppointments).toBe(true)
    expect(permissions.canAccessClinicalHistory).toBe(true)
    expect(permissions.canAccessOdontogram).toBe(true)
    expect(permissions.canAccessReminders).toBe(false)
    expect(permissions.canAccessSettings).toBe(false)
    expect(permissions.canManageClinicUsers).toBe(false)
    expect(permissions.canManageWhatsapp).toBe(false)
  })

  it('allows only clinical owner, admin and doctor to write clinical history', () => {
    expect(
      getClinicalPermissions('clinic_owner', 'basic').canAccessClinicalHistory,
    ).toBe(true)
    expect(
      getClinicalPermissions('clinic_admin', 'basic').canAccessClinicalHistory,
    ).toBe(true)
    expect(
      getClinicalPermissions('doctor', 'basic').canAccessClinicalHistory,
    ).toBe(true)
    expect(
      getClinicalPermissions('receptionist', 'pro').canAccessClinicalHistory,
    ).toBe(false)
    expect(
      getClinicalPermissions('platform_admin', 'pro').canAccessClinicalHistory,
    ).toBe(false)
  })

  it('allows only owner, admin and doctor to use the odontogram', () => {
    expect(getClinicalPermissions('clinic_owner', 'basic').canAccessOdontogram).toBe(true)
    expect(getClinicalPermissions('clinic_admin', 'basic').canAccessOdontogram).toBe(true)
    expect(getClinicalPermissions('doctor', 'basic').canAccessOdontogram).toBe(true)
    expect(getClinicalPermissions('receptionist', 'pro').canAccessOdontogram).toBe(false)
    expect(getClinicalPermissions('platform_admin', 'pro').canAccessOdontogram).toBe(false)
  })

  it('keeps reception away from history, odontogram and settings', () => {
    const permissions = getClinicalPermissions('receptionist', 'pro')

    expect(permissions.canAccessDashboard).toBe(true)
    expect(permissions.canAccessPatients).toBe(true)
    expect(permissions.canAccessAppointments).toBe(true)
    expect(permissions.canAccessReminders).toBe(true)
    expect(permissions.canAccessClinicalHistory).toBe(false)
    expect(permissions.canAccessOdontogram).toBe(false)
    expect(permissions.canAccessSettings).toBe(false)
  })

  it('applies plan gates to users and automatic WhatsApp', () => {
    expect(canManageClinicUsers('clinic_owner', 'basic')).toBe(false)
    expect(canManageClinicUsers('clinic_owner', 'medium')).toBe(true)
    expect(canManageClinicUsers('clinic_owner', 'pro')).toBe(true)
    expect(canManageClinicUsers('clinic_admin', 'medium')).toBe(true)
    expect(canManageClinicUsers('doctor', 'pro')).toBe(false)
    expect(canManageClinicUsers('receptionist', 'pro')).toBe(false)
    expect(canManageWhatsapp('clinic_owner', 'basic')).toBe(false)
    expect(canManageWhatsapp('clinic_owner', 'medium')).toBe(false)
    expect(canManageWhatsapp('clinic_owner', 'pro')).toBe(true)
  })

  it('treats an unknown plan as the minimum safe plan', () => {
    const permissions = getClinicalPermissions('clinic_owner', 'enterprise')

    expect(permissions.canAccessDashboard).toBe(true)
    expect(permissions.canManageClinicUsers).toBe(false)
    expect(permissions.canManageWhatsapp).toBe(false)
  })

  it('returns safe readable role labels', () => {
    expect(getUserRoleLabel('owner')).toBe('Propietario del consultorio')
    expect(getUserRoleLabel('admin')).toBe('Administrador del consultorio')
    expect(getUserRoleLabel('receptionist')).toBe('Recepcionista')
    expect(getUserRoleLabel(null)).toBe('Rol no válido')
  })
})
