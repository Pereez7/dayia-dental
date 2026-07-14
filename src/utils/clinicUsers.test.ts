import { describe, expect, it } from 'vitest'

import {
  clinicUserRoleOptions,
  getClinicUserRoleLabel,
  hasClinicUserFormErrors,
  isOnlyCurrentClinicUser,
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
  validateClinicUserForm,
} from './clinicUsers'

describe('clinic users helpers', () => {
  it('exposes only clinic-level roles for the form', () => {
    expect(clinicUserRoleOptions.map((option) => option.value)).toEqual([
      'clinic_admin',
      'doctor',
      'receptionist',
    ])
  })

  it('returns compact readable role labels', () => {
    expect(getClinicUserRoleLabel('clinic_owner')).toBe(
      'Propietario del consultorio',
    )
    expect(getClinicUserRoleLabel('clinic_admin')).toBe(
      'Administrador del consultorio',
    )
    expect(getClinicUserRoleLabel('receptionist')).toBe('Recepción')
    expect(getClinicUserRoleLabel('super_admin')).toBe(
      'Administrador del consultorio',
    )
  })

  it('normalizes email before sending it to the backend', () => {
    expect(normalizeClinicUserEmail('  CHARLES@DAYIA.COM  ')).toBe(
      'charles@dayia.com',
    )
  })

  it('normalizes names as person names instead of sentences', () => {
    expect(normalizeClinicUserFullName('Fabricio Pérez Suarez')).toBe(
      'Fabricio Pérez Suarez',
    )
    expect(normalizeClinicUserFullName('fabricio pérez suarez')).toBe(
      'Fabricio Pérez Suarez',
    )
  })

  it('validates required user form fields', () => {
    const errors = validateClinicUserForm({
      email: 'no-es-email',
      fullName: '',
      role: 'doctor',
    })

    expect(hasClinicUserFormErrors(errors)).toBe(true)
    expect(errors.fullName).toBe('Ingresa el nombre completo.')
    expect(errors.email).toBe('Ingresa un email válido.')
  })

  it('detects when only the current user is listed', () => {
    expect(
      isOnlyCurrentClinicUser(
        [
          {
            activatedAt: null,
            clinicId: 'clinic-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            email: null,
            fullName: 'Charles Pérez',
            id: 'user-1',
            invitedAt: null,
            role: 'clinic_admin',
            status: 'active',
          },
        ],
        'user-1',
      ),
    ).toBe(true)

    expect(isOnlyCurrentClinicUser([], 'user-1')).toBe(false)
  })
})
