import { useRef, useState, type FormEvent } from 'react'

import { supabase } from '../lib/supabaseClient'
import { completeAccountActivation } from '../services/accountActivationService'
import {
  hasActivationPasswordErrors,
  runAccountActivationOnce,
  validateActivationPasswordForm,
  type ActivationPasswordErrors,
} from '../utils/accountActivation'

interface ActivateAccountViewProps {
  onActivated: () => Promise<void> | void
}

export function ActivateAccountView({ onActivated }: ActivateAccountViewProps) {
  const submissionLock = useRef(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ActivationPasswordErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateActivationPasswordForm({
      confirmPassword,
      password,
    })
    setFieldErrors(nextErrors)
    setFormError('')
    setSuccessMessage('')

    if (hasActivationPasswordErrors(nextErrors)) {
      return
    }

    if (!supabase) {
      setFormError('Supabase no está configurado para activar accesos.')
      return
    }

    const activationClient = supabase

    if (submissionLock.current) {
      return
    }

    setIsSubmitting(true)
    const result = await runAccountActivationOnce(submissionLock, {
      completeActivation: async () => {
        const { error } = await completeAccountActivation()
        return { error }
      },
      updatePassword: async () => {
        const { error } = await activationClient.auth.updateUser({ password })
        return {
          error: error
            ? { code: error.code, message: error.message }
            : null,
        }
      },
    })
    setIsSubmitting(false)

    if (result.status === 'ignored') {
      return
    }

    if (result.error) {
      setFormError(result.error)
      return
    }

    setPassword('')
    setConfirmPassword('')
    setSuccessMessage(
      'Tu acceso fue activado correctamente. Ya puedes iniciar sesión.',
    )
    window.setTimeout(() => {
      onActivated()
    }, 1400)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="activation-title">
        <div className="auth-heading">
          <span>DayIA Dental</span>
          <h1 id="activation-title">Activa tu acceso</h1>
          <p>
            Crea tu contraseña para ingresar al consultorio con tu cuenta
            invitada.
          </p>
        </div>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            <span>Nueva contraseña</span>
            <input
              aria-describedby={
                fieldErrors.password ? 'activation-password-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              disabled={isSubmitting || Boolean(successMessage)}
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => {
                const nextPassword = event.target.value
                setPassword(nextPassword)

                if (fieldErrors.password || fieldErrors.confirmPassword) {
                  setFieldErrors(
                    validateActivationPasswordForm({
                      confirmPassword,
                      password: nextPassword,
                    }),
                  )
                }
              }}
            />
            {fieldErrors.password && (
              <small
                className="field-message field-message--error"
                id="activation-password-error"
              >
                {fieldErrors.password}
              </small>
            )}
          </label>

          <label>
            <span>Confirmar contraseña</span>
            <input
              aria-describedby={
                fieldErrors.confirmPassword
                  ? 'activation-confirm-password-error'
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              disabled={isSubmitting || Boolean(successMessage)}
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                const nextConfirmPassword = event.target.value
                setConfirmPassword(nextConfirmPassword)

                if (fieldErrors.password || fieldErrors.confirmPassword) {
                  setFieldErrors(
                    validateActivationPasswordForm({
                      confirmPassword: nextConfirmPassword,
                      password,
                    }),
                  )
                }
              }}
            />
            {fieldErrors.confirmPassword && (
              <small
                className="field-message field-message--error"
                id="activation-confirm-password-error"
              >
                {fieldErrors.confirmPassword}
              </small>
            )}
          </label>

          {formError && (
            <p className="field-message field-message--error">{formError}</p>
          )}

          {successMessage && (
            <p className="field-message field-message--success">
              {successMessage}
            </p>
          )}

          <button
            className="primary-action"
            disabled={isSubmitting || Boolean(successMessage)}
            type="submit"
          >
            {isSubmitting ? 'Activando...' : 'Activar acceso'}
          </button>
        </form>
      </section>
    </main>
  )
}
