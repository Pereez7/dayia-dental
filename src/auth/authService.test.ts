import { describe, expect, it } from 'vitest'

import { getPublicPasswordResetErrorMessage } from './authService'

describe('getPublicPasswordResetErrorMessage', () => {
  it('explains email rate limits without reporting a login failure', () => {
    expect(
      getPublicPasswordResetErrorMessage(
        'Email rate limit exceeded',
        'over_email_send_rate_limit',
      ),
    ).toBe(
      'Ya solicitaste varios enlaces. Espera unos minutos antes de intentarlo nuevamente.',
    )
  })

  it('reports an unauthorized recovery redirect', () => {
    expect(
      getPublicPasswordResetErrorMessage('Redirect URL is not allowed'),
    ).toBe('La dirección de recuperación no está autorizada en Supabase.')
  })

  it('uses a recovery-specific fallback', () => {
    expect(getPublicPasswordResetErrorMessage('Unexpected error')).toBe(
      'No pudimos enviar el enlace de recuperación. Inténtalo nuevamente más tarde.',
    )
  })
})
