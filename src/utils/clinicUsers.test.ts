import { describe, expect, it } from 'vitest'

import {
  clinicUserRoleOptions,
  getClinicUserRoleLabel,
  hasClinicUserFormErrors,
  isOnlyCurrentClinicUser,
  normalizeClinicUserEmail,
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
    expect(getClinicUserRoleLabel('clinic_admin')).toBe('Administrador')
    expect(getClinicUserRoleLabel('receptionist')).toBe('Recepción')
    expect(getClinicUserRoleLabel('super_admin')).toBe('Super administrador')
  })

  it('normalizes email before sending it to the backend', () => {
    expect(normalizeClinicUserEmail('  CHARLES@DAYIA.COM  ')).toBe(
      'charles@dayia.com',
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
            clinicId: 'clinic-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            email: null,
            fullName: 'Charles Pérez',
            id: 'user-1',
            isActive: true,
            role: 'clinic_admin',
          },
        ],
        'user-1',
      ),
    ).toBe(true)

    expect(isOnlyCurrentClinicUser([], 'user-1')).toBe(false)
  })
})
