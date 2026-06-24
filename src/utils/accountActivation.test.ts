import { describe, expect, it } from 'vitest'

import {
  hasActivationPasswordErrors,
  isAccountActivationRoute,
  validateActivationPasswordForm,
} from './accountActivation'

describe('account activation helpers', () => {
  it('detects the public activation route', () => {
    expect(isAccountActivationRoute({ pathname: '/activar-cuenta' })).toBe(true)
    expect(isAccountActivationRoute({ pathname: '/' })).toBe(false)
    expect(isAccountActivationRoute({ pathname: '/configuracion' })).toBe(false)
  })

  it('validates required activation passwords', () => {
    const errors = validateActivationPasswordForm({
      confirmPassword: '',
      password: '',
    })

    expect(errors.password).toBe('Ingresa una nueva contraseña.')
    expect(errors.confirmPassword).toBe('Confirma tu nueva contraseña.')
    expect(hasActivationPasswordErrors(errors)).toBe(true)
  })

  it('requires at least eight characters', () => {
    const errors = validateActivationPasswordForm({
      confirmPassword: '1234567',
      password: '1234567',
    })

    expect(errors.password).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    )
  })

  it('requires matching passwords', () => {
    const errors = validateActivationPasswordForm({
      confirmPassword: 'password-2',
      password: 'password-1',
    })

    expect(errors.confirmPassword).toBe('Las contraseñas no coinciden.')
  })

  it('accepts a valid activation password form', () => {
    const errors = validateActivationPasswordForm({
      confirmPassword: 'password-1',
      password: 'password-1',
    })

    expect(hasActivationPasswordErrors(errors)).toBe(false)
  })
})
