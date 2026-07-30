import { useId, useState, type FormEvent } from 'react'

import { validatePlatformOwnerEmailCorrection } from '../utils/platformOwnerEmail'

export interface PlatformInvitationNotice {
  message: string
  tone: 'error' | 'success'
}

interface PlatformOwnerInvitationActionsProps {
  canCorrectEmail: boolean
  canResend: boolean
  currentEmail: string
  isCorrecting: boolean
  isDisabled?: boolean
  isResending: boolean
  notice?: PlatformInvitationNotice
  onCorrectEmail?: (email: string) => Promise<boolean>
  onResend?: () => void
}

export function PlatformOwnerInvitationActions({
  canCorrectEmail,
  canResend,
  currentEmail,
  isCorrecting,
  isDisabled = false,
  isResending,
  notice,
  onCorrectEmail,
  onResend,
}: PlatformOwnerInvitationActionsProps) {
  const emailErrorId = useId()
  const [email, setEmail] = useState(currentEmail)
  const [emailError, setEmailError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const actionsDisabled = isCorrecting || isDisabled || isResending

  function startEditing() {
    setEmail(currentEmail)
    setEmailError('')
    setIsEditing(true)
  }

  function cancelEditing() {
    setEmail(currentEmail)
    setEmailError('')
    setIsEditing(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!onCorrectEmail || actionsDisabled) {
      return
    }

    const validationError = validatePlatformOwnerEmailCorrection(
      email,
      currentEmail,
    )
    setEmailError(validationError)

    if (validationError) {
      return
    }

    const wasCorrected = await onCorrectEmail(email.trim().toLowerCase())

    if (wasCorrected) {
      setIsEditing(false)
    }
  }

  return (
    <div className="platform-owner-invitation">
      {canResend ? <span>Invitación pendiente</span> : null}

      <div className="platform-owner-invitation-actions">
        {canResend && onResend ? (
          <button
            className="platform-owner-invitation-action"
            disabled={actionsDisabled}
            onClick={onResend}
            type="button"
          >
            {isResending ? 'Reenviando…' : 'Reenviar invitación'}
          </button>
        ) : null}
        {canCorrectEmail && onCorrectEmail ? (
          <button
            className="platform-owner-invitation-action"
            disabled={actionsDisabled}
            onClick={startEditing}
            type="button"
          >
            Editar correo
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="platform-owner-email-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <label>
            <span>Nuevo email</span>
            <input
              aria-describedby={
                emailError ? emailErrorId : undefined
              }
              aria-invalid={Boolean(emailError)}
              autoComplete="email"
              className="field-control"
              disabled={actionsDisabled}
              inputMode="email"
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailError('')
              }}
              type="email"
              value={email}
            />
          </label>
          {emailError ? (
            <small
              className="field-message field-message--error"
              id={emailErrorId}
            >
              {emailError}
            </small>
          ) : null}
          <p>
            Se reemplazará al propietario pendiente y se enviará una invitación
            al nuevo correo.
          </p>
          <div>
            <button
              className="primary-action"
              disabled={actionsDisabled}
              type="submit"
            >
              {isCorrecting ? 'Guardando…' : 'Guardar y reenviar'}
            </button>
            <button
              className="secondary-action"
              disabled={actionsDisabled}
              onClick={cancelEditing}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {notice ? (
        <p
          className={`platform-owner-invitation-feedback platform-owner-invitation-feedback--${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  )
}
