import { describe, expect, it } from 'vitest'

import { getSessionPlanLabel, getSessionRoleLabel } from './sessionRole'

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

  it('shows the real plan only for clinic owners', () => {
    expect(
      getSessionPlanLabel({ planId: 'basic', role: 'clinic_owner' }),
    ).toBe('Plan Basic')
    expect(
      getSessionPlanLabel({ planId: 'medium', role: 'clinic_owner' }),
    ).toBe('Plan Medium')
    expect(
      getSessionPlanLabel({ planId: 'pro', role: 'clinic_owner' }),
    ).toBe('Plan Pro')
    expect(getSessionPlanLabel({ planId: 'pro', role: 'doctor' })).toBeNull()
    expect(
      getSessionPlanLabel({ planId: 'pro', role: 'receptionist' }),
    ).toBeNull()
  })

  it('does not invent a plan when the subscription is unresolved', () => {
    expect(
      getSessionPlanLabel({ planId: null, role: 'clinic_owner' }),
    ).toBeNull()
    expect(
      getSessionPlanLabel({ planId: 'enterprise', role: 'clinic_owner' }),
    ).toBeNull()
  })
})
