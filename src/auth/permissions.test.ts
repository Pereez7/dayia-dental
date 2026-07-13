import { describe, expect, it } from 'vitest'

import {
  canAccessPlatformAdministration,
  canManageAppointments,
  canManageClinicSettings,
  canManagePatients,
  canManageUsers,
  canManageWhatsapp,
  canViewClinicalRecords,
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

  it('normalizes missing, empty and unknown roles without permissions', () => {
    expect(normalizeUserRole(null)).toBe('unknown')
    expect(normalizeUserRole(undefined)).toBe('unknown')
    expect(normalizeUserRole('')).toBe('unknown')
    expect(normalizeUserRole('   ')).toBe('unknown')
    expect(normalizeUserRole('clinic_owenr')).toBe('unknown')
    expect(normalizeUserRole('dentist')).toBe('unknown')
    expect(normalizeUserRole('reception')).toBe('unknown')
  })

  it.each([null, '', 'unknown-role', 'clinic_owenr']) (
    'denies every permission for invalid role %s',
    (role) => {
      expect(canManagePatients(role)).toBe(false)
      expect(canManageAppointments(role)).toBe(false)
      expect(canManageClinicSettings(role)).toBe(false)
      expect(canManageWhatsapp(role)).toBe(false)
      expect(canManageUsers(role)).toBe(false)
      expect(canViewClinicalRecords(role)).toBe(false)
      expect(
        canAccessPlatformAdministration({
          is_platform_admin: false,
          role,
        }),
      ).toBe(false)
    },
  )

  it('keeps explicit platform administrators authorized', () => {
    expect(
      canAccessPlatformAdministration({
        is_platform_admin: true,
        role: null,
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

  it('keeps clinic permissions scoped to known roles', () => {
    expect(canManagePatients('clinic_owner')).toBe(true)
    expect(canManageAppointments('clinic_admin')).toBe(true)
    expect(canManagePatients('doctor')).toBe(true)
    expect(canManageAppointments('receptionist')).toBe(true)
    expect(canViewClinicalRecords('doctor')).toBe(true)
    expect(canViewClinicalRecords('receptionist')).toBe(false)
    expect(canManageClinicSettings('clinic_owner')).toBe(true)
    expect(canManageUsers('clinic_admin')).toBe(true)
    expect(canManageWhatsapp('doctor')).toBe(false)
  })

  it('returns safe readable role labels', () => {
    expect(getUserRoleLabel('owner')).toBe('Propietario del consultorio')
    expect(getUserRoleLabel('admin')).toBe('Administrador del consultorio')
    expect(getUserRoleLabel('receptionist')).toBe('Recepcionista')
    expect(getUserRoleLabel(null)).toBe('Rol no válido')
    expect(getUserRoleLabel('clinic_owenr')).toBe('Rol no válido')
    expect(getUserRoleLabel('super_admin')).toBe('Rol no válido')
  })
})
