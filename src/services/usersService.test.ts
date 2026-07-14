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
      activatedAt: null,
      clinicId: 'clinic-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      email: null,
      fullName: 'Charles Pérez',
      id: 'user-1',
      invitedAt: null,
      role: 'clinic_admin',
      status: 'active',
    })
  })

  it('maps create user error codes to public messages', () => {
    expect(getCreateUserResponseErrorMessage('EMAIL_ALREADY_EXISTS')).toBe(
      'Este correo ya está registrado.',
    )
    expect(getCreateUserResponseErrorMessage('FORBIDDEN')).toBe(
      'No tienes permiso para crear usuarios.',
    )
    expect(getCreateUserResponseErrorMessage('SERVER_CONFIGURATION_ERROR')).toBe(
      'La creación de usuarios no está configurada en el servidor.',
    )
    expect(getCreateUserResponseErrorMessage('INVALID_ROLE')).toBe(
      'El rol seleccionado no es válido.',
    )
    expect(getCreateUserResponseErrorMessage('function_not_found')).toBe(
      'La función de creación de usuarios no está desplegada.',
    )
    expect(getCreateUserResponseErrorMessage('AUTH_ADMIN_ERROR')).toBe(
      'No pudimos crear el usuario en Supabase Auth.',
    )
    expect(getCreateUserResponseErrorMessage('AUTH_ADMIN_PERMISSION_ERROR')).toBe(
      'No fue posible crear el acceso del nuevo usuario.',
    )
    expect(getCreateUserResponseErrorMessage('INVITATION_SEND_ERROR')).toBe(
      'No pudimos enviar la invitación del nuevo usuario.',
    )
    expect(getCreateUserResponseErrorMessage('PROFILE_NOT_FOUND')).toBe(
      'No encontramos tu perfil de administrador.',
    )
    expect(getCreateUserResponseErrorMessage('PROFILE_QUERY_FAILED')).toBe(
      'No pudimos validar el perfil del administrador.',
    )
    expect(getCreateUserResponseErrorMessage('CLINIC_NOT_LINKED')).toBe(
      'Tu perfil no está vinculado a un consultorio.',
    )
  })
})
