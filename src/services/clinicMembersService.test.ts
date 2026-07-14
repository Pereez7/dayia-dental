import { describe, expect, it } from 'vitest'

import {
  getClinicMembersResponseError,
  mapMembershipToClinicUser,
} from './clinicMembersService'

describe('clinic members service', () => {
  it('maps membership role and status instead of legacy profile fields', () => {
    expect(
      mapMembershipToClinicUser({
        clinicId: 'clinic-1',
        email: 'OWNER@CLINIC.COM',
        fullName: 'Dra. Vaca',
        role: 'clinic_owner',
        status: 'active',
        userId: 'user-1',
      }),
    ).toMatchObject({
      clinicId: 'clinic-1',
      email: 'owner@clinic.com',
      id: 'user-1',
      role: 'clinic_owner',
      status: 'active',
    })
  })

  it('maps safe invitation errors', () => {
    expect(getClinicMembersResponseError('MEMBER_LIMIT_REACHED')).toBe(
      'Tu plan alcanzó el límite de usuarios.',
    )
    expect(getClinicMembersResponseError('MEMBERSHIP_ALREADY_EXISTS')).toBe(
      'Este usuario ya pertenece al consultorio.',
    )
    expect(getClinicMembersResponseError('INVALID_ROLE')).toBe(
      'El rol seleccionado no es válido.',
    )
  })

  it('repairs sentence-cased names when mapping existing memberships', () => {
    expect(
      mapMembershipToClinicUser({
        fullName: 'Fabricio pérez suarez',
        role: 'doctor',
        status: 'active',
        userId: 'user-2',
      }).fullName,
    ).toBe('Fabricio Pérez Suarez')
  })
})
