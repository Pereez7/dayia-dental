import { describe, expect, it } from 'vitest'

import { validatePlatformOwnerEmailCorrection } from './platformOwnerEmail'

describe('platform owner email correction', () => {
  it('rejects an invalid email', () => {
    expect(validatePlatformOwnerEmailCorrection('correo', null)).toBe(
      'Ingresa un email válido.',
    )
  })

  it('rejects the current email ignoring case and spaces', () => {
    expect(
      validatePlatformOwnerEmailCorrection(
        ' OWNER@EXAMPLE.COM ',
        'owner@example.com',
      ),
    ).toBe('Ingresa un correo diferente al actual.')
  })

  it('accepts a different valid email', () => {
    expect(
      validatePlatformOwnerEmailCorrection(
        'new.owner@example.com',
        'owner@example.com',
      ),
    ).toBe('')
  })
})
