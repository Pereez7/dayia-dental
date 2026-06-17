import { describe, expect, it } from 'vitest'

import {
  canManageClinicSettings,
  canManageUsers,
  canManageWhatsapp,
  canViewClinicalRecords,
  getUserRoleLabel,
  normalizeUserRole,
} from './permissions'

describe('auth permissions', () => {
  it('normalizes legacy roles to the current MVP roles', () => {
    expect(normalizeUserRole('owner')).toBe('clinic_admin')
    expect(normalizeUserRole('admin')).toBe('clinic_admin')
    expect(normalizeUserRole('dentist')).toBe('doctor')
    expect(normalizeUserRole('reception')).toBe('receptionist')
  })

  it('allows only admin roles to manage sensitive clinic areas', () => {
    expect(canManageClinicSettings('clinic_admin')).toBe(true)
    expect(canManageUsers('super_admin')).toBe(true)
    expect(canManageWhatsapp('doctor')).toBe(false)
    expect(canManageClinicSettings('receptionist')).toBe(false)
  })

  it('keeps clinical records visible to admins and doctors', () => {
    expect(canViewClinicalRecords('clinic_admin')).toBe(true)
    expect(canViewClinicalRecords('doctor')).toBe(true)
    expect(canViewClinicalRecords('receptionist')).toBe(false)
  })

  it('returns readable role labels', () => {
    expect(getUserRoleLabel('admin')).toBe('Administrador del consultorio')
    expect(getUserRoleLabel('receptionist')).toBe('Recepcionista')
  })
})
