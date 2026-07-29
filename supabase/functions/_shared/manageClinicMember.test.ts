import { describe, expect, it } from 'vitest'

import {
  getTargetMembershipStatus,
  ManageClinicMemberError,
  normalizeManageClinicMemberPayload,
} from './manageClinicMember'

describe('manage clinic member helpers', () => {
  it('normalizes a valid deactivation request', () => {
    expect(
      normalizeManageClinicMemberPayload({
        action: 'deactivate',
        membershipId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
        reason: '  Ya no trabaja   en el consultorio. ',
      }),
    ).toEqual({
      action: 'deactivate',
      membershipId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      reason: 'Ya no trabaja en el consultorio.',
    })
  })

  it('requires a meaningful reason', () => {
    expect(() =>
      normalizeManageClinicMemberPayload({
        action: 'reactivate',
        membershipId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
        reason: 'ok',
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ManageClinicMemberError>>({
        code: 'INVALID_REASON',
        status: 400,
      }),
    )
  })

  it('rejects unknown actions and invalid ids', () => {
    expect(() =>
      normalizeManageClinicMemberPayload({
        action: 'delete',
        membershipId: 'member-1',
        reason: 'Motivo suficiente',
      }),
    ).toThrow(ManageClinicMemberError)
  })

  it('maps lifecycle actions to reversible membership statuses', () => {
    expect(getTargetMembershipStatus('deactivate')).toBe('inactive')
    expect(getTargetMembershipStatus('reactivate')).toBe('active')
  })
})
