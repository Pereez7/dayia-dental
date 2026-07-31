import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from 'react'

import { validatePlatformOwnerEmailCorrection } from '../utils/platformOwnerEmail'
import { ConfirmDialog } from './ConfirmDialog'

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
  const formId = useId()
  const emailInputRef = useRef<HTMLInputElement>(null)
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
    if (actionsDisabled) {
      return
    }

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
            aria-label="Reenviar invitación al propietario"
            disabled={actionsDisabled}
            onClick={onResend}
            type="button"
          >
            {isResending ? 'Reenviando…' : 'Reenviar'}
          </button>
        ) : null}
        {canCorrectEmail && onCorrectEmail ? (
          <button
            className="platform-owner-invitation-action"
            aria-label="Editar correo del propietario"
            disabled={actionsDisabled}
            onClick={startEditing}
            type="button"
          >
            Editar
          </button>
        ) : null}
      </div>

      <PlatformOwnerEmailCorrectionDialog
        currentEmail={currentEmail}
        email={email}
        emailError={emailError}
        emailErrorId={emailErrorId}
        emailInputRef={emailInputRef}
        formId={formId}
        isCorrecting={isCorrecting}
        isDisabled={actionsDisabled}
        isOpen={isEditing}
        notice={notice?.tone === 'error' ? notice : undefined}
        onCancel={cancelEditing}
        onChange={(event) => {
          setEmail(event.target.value)
          setEmailError('')
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

interface PlatformOwnerEmailCorrectionDialogProps {
  currentEmail: string
  email: string
  emailError: string
  emailErrorId: string
  emailInputRef: RefObject<HTMLInputElement | null>
  formId: string
  isCorrecting: boolean
  isDisabled: boolean
  isOpen: boolean
  notice?: PlatformInvitationNotice
  onCancel: () => void
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function PlatformOwnerEmailCorrectionDialog({
  currentEmail,
  email,
  emailError,
  emailErrorId,
  emailInputRef,
  formId,
  isCorrecting,
  isDisabled,
  isOpen,
  notice,
  onCancel,
  onChange,
  onSubmit,
}: PlatformOwnerEmailCorrectionDialogProps) {
  return (
    <ConfirmDialog
      cancelLabel="Cancelar"
      confirmFormId={formId}
      confirmLabel={isCorrecting ? 'Guardando…' : 'Guardar y reenviar'}
      confirmType="submit"
      initialFocusRef={emailInputRef}
      isCancelDisabled={isDisabled}
      isConfirmDisabled={isDisabled}
      isOpen={isOpen}
      message="Reemplazaremos el correo del propietario pendiente y enviaremos una invitación nueva."
      title="Editar correo del propietario"
      variant="info"
      onCancel={onCancel}
    >
      <form
        className="platform-owner-email-dialog-form"
        id={formId}
        noValidate
        onSubmit={onSubmit}
      >
        <div className="platform-owner-email-current">
          <span>Correo actual</span>
          <strong>{currentEmail}</strong>
        </div>

        <label className="platform-owner-email-field">
          <span>Nuevo correo</span>
          <input
            aria-describedby={emailError ? emailErrorId : undefined}
            aria-invalid={Boolean(emailError)}
            autoComplete="email"
            className="field-control"
            disabled={isDisabled}
            inputMode="email"
            onChange={onChange}
            placeholder="nuevo@consultorio.com"
            ref={emailInputRef}
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

        {notice ? (
          <p
            className="platform-owner-email-dialog-error"
            role="alert"
          >
            {notice.message}
          </p>
        ) : null}
      </form>
    </ConfirmDialog>
  )
}
