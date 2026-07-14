import { describe, expect, it, vi } from 'vitest'

import {
  hasActivationPasswordErrors,
  isPasswordAlreadyConfiguredError,
  isAccountActivationRoute,
  runAccountActivationOnce,
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

  it('recognizes an already configured password response', () => {
    expect(isPasswordAlreadyConfiguredError({ code: 'same_password' })).toBe(true)
  })

  it('completes membership activation after saving the password', async () => {
    const calls: string[] = []

    await expect(
      runAccountActivationOnce(
        { current: false },
        {
          completeActivation: async () => {
            calls.push('activation')
            return { error: null }
          },
          updatePassword: async () => {
            calls.push('password')
            return { error: null }
          },
        },
      ),
    ).resolves.toEqual({ error: null, status: 'success' })
    expect(calls).toEqual(['password', 'activation'])
  })

  it('continues activation when the password was already configured', async () => {
    const completeActivation = vi.fn().mockResolvedValue({ error: null })

    await expect(
      runAccountActivationOnce(
        { current: false },
        {
          completeActivation,
          updatePassword: vi.fn().mockResolvedValue({
            error: { code: 'same_password' },
          }),
        },
      ),
    ).resolves.toEqual({ error: null, status: 'success' })
    expect(completeActivation).toHaveBeenCalledOnce()
  })

  it('blocks duplicate activation submissions', async () => {
    const completeActivation = vi.fn().mockResolvedValue({ error: null })
    const lock = { current: true }

    await expect(
      runAccountActivationOnce(lock, {
        completeActivation,
        updatePassword: vi.fn(),
      }),
    ).resolves.toEqual({ error: null, status: 'ignored' })
    expect(completeActivation).not.toHaveBeenCalled()
  })
})
