import { describe, expect, it, vi } from 'vitest'

import {
  getClinicMembersResponseError,
  manageClinicMemberWithClient,
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

  it('deactivates a membership through the protected lifecycle Function', async () => {
    const response = {
      member: {
        activatedAt: '2026-07-01T10:00:00.000Z',
        clinicId: 'clinic-1',
        createdAt: '2026-07-01T10:00:00.000Z',
        email: 'doctor@clinic.com',
        fullName: 'Dr. Luis Pérez',
        invitedAt: null,
        membershipId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
        role: 'doctor',
        status: 'inactive',
        userId: 'doctor-1',
      },
      memberCount: 2,
    }
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: response, error: null }),
      },
    }
    const input = {
      action: 'deactivate' as const,
      membershipId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      reason: 'Ya no trabaja en el consultorio.',
    }

    await expect(
      manageClinicMemberWithClient(client, input),
    ).resolves.toMatchObject({
      data: {
        member: {
          id: 'doctor-1',
          membershipId: input.membershipId,
          status: 'inactive',
        },
        memberCount: 2,
      },
      error: null,
    })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'manage-clinic-member',
      { body: input, method: 'POST' },
    )
  })

  it('maps protected lifecycle conflicts to friendly messages', () => {
    expect(getClinicMembersResponseError('OWNER_PROTECTED')).toBe(
      'El propietario no puede desactivarse desde la gestión de usuarios.',
    )
    expect(getClinicMembersResponseError('SELF_ACTION_NOT_ALLOWED')).toBe(
      'No puedes desactivar tu propio acceso.',
    )
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
