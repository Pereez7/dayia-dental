import { describe, expect, it } from 'vitest'

import {
  getInvitationResendWaitSeconds,
  normalizeResendInvitationPayload,
  ResendPlatformClinicInvitationError,
} from './resendPlatformClinicInvitation'

describe('resend platform clinic invitation helpers', () => {
  it('accepts a valid clinic id', () => {
    expect(
      normalizeResendInvitationPayload({
        clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      }),
    ).toEqual({ clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75' })
  })

  it('rejects an invalid clinic id', () => {
    expect(() =>
      normalizeResendInvitationPayload({ clinicId: 'clinic-1' }),
    ).toThrow(ResendPlatformClinicInvitationError)
  })

  it('calculates the remaining resend cooldown', () => {
    const now = Date.parse('2026-07-27T22:00:30.000Z')

    expect(
      getInvitationResendWaitSeconds('2026-07-27T22:00:00.000Z', now),
    ).toBe(30)
    expect(
      getInvitationResendWaitSeconds('2026-07-27T21:58:00.000Z', now),
    ).toBe(0)
  })
})
