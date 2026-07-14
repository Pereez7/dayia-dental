import { describe, expect, it } from 'vitest'

import { getSessionRoleLabel } from './sessionRole'

describe('session role label', () => {
  it('shows owner for the resolved clinic owner role', () => {
    expect(
      getSessionRoleLabel({
        isDemoMode: false,
        isPlatformAdministration: false,
        role: 'clinic_owner',
      }),
    ).toBe('Propietario')
  })

  it('shows the DayIA label for a pure platform administrator', () => {
    expect(
      getSessionRoleLabel({
        isDemoMode: false,
        isPlatformAdministration: true,
        role: null,
      }),
    ).toBe('Administrador DayIA')
  })

  it('keeps safe labels for clinical and unknown roles', () => {
    expect(
      getSessionRoleLabel({
        isDemoMode: false,
        isPlatformAdministration: false,
        role: 'clinic_admin',
      }),
    ).toBe('Administrador')
    expect(
      getSessionRoleLabel({
        isDemoMode: false,
        isPlatformAdministration: false,
        role: 'invalid',
      }),
    ).toBe('Rol no válido')
  })
})
