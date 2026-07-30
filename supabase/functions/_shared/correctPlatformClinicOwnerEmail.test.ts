import { describe, expect, it } from 'vitest'

import {
  CorrectPlatformClinicOwnerEmailError,
  isRegisteredAuthEmailError,
  normalizeCorrectPlatformClinicOwnerEmailPayload,
} from './correctPlatformClinicOwnerEmail'

describe('correct platform clinic owner email helpers', () => {
  it('normalizes a valid clinic and owner email', () => {
    expect(
      normalizeCorrectPlatformClinicOwnerEmailPayload({
        clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
        ownerEmail: ' NEW.OWNER@EXAMPLE.COM ',
      }),
    ).toEqual({
      clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      ownerEmail: 'new.owner@example.com',
    })
  })

  it.each([
    {},
    { clinicId: 'clinic-1', ownerEmail: 'owner@example.com' },
    {
      clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      ownerEmail: 'correo',
    },
  ])('rejects invalid correction payload %#', (payload) => {
    expect(() =>
      normalizeCorrectPlatformClinicOwnerEmailPayload(payload),
    ).toThrow(CorrectPlatformClinicOwnerEmailError)
  })

  it('recognizes duplicate Auth identity errors', () => {
    expect(
      isRegisteredAuthEmailError({
        message: 'A user with this email address has already been registered',
        status: 422,
      }),
    ).toBe(true)
    expect(isRegisteredAuthEmailError({ message: 'network', status: 500 }))
      .toBe(false)
  })
})
