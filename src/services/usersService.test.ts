import { describe, expect, it } from 'vitest'

import {
  getCreateUserResponseErrorMessage,
  mapProfileToClinicUser,
} from './usersService'

describe('users service mapping', () => {
  it('maps base profile fields without requiring optional email or status columns', () => {
    expect(
      mapProfileToClinicUser({
        clinic_id: 'clinic-1',
        created_at: '2026-01-01T00:00:00.000Z',
        full_name: 'Charles Pérez',
        id: 'user-1',
        role: 'clinic_admin',
        updated_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      clinicId: 'clinic-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      email: null,
      fullName: 'Charles Pérez',
      id: 'user-1',
      isActive: true,
      role: 'clinic_admin',
    })
  })

  it('maps create user error codes to public messages', () => {
    expect(getCreateUserResponseErrorMessage('email_exists')).toBe(
      'Este correo ya está registrado.',
    )
    expect(getCreateUserResponseErrorMessage('forbidden')).toBe(
      'No tienes permiso para crear usuarios.',
    )
    expect(getCreateUserResponseErrorMessage('server_not_configured')).toBe(
      'La creación de usuarios no está configurada todavía.',
    )
  })
})
