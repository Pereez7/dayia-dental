import { useEffect, useId, useRef, type ReactNode } from 'react'

export type ConfirmDialogVariant = 'danger' | 'info' | 'warning'

interface ConfirmDialogProps {
  cancelLabel: string
  children?: ReactNode
  confirmLabel: string
  isOpen: boolean
  message: string
  title: string
  variant: ConfirmDialogVariant
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  isOpen,
  message,
  title,
  variant,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    cancelButtonRef.current?.focus()
    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) {
    return null
  }

  return (
    <div className="confirm-dialog-overlay">
      <div
        aria-describedby={messageId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`confirm-dialog confirm-dialog--${variant}`}
        role="dialog"
      >
        <div className="confirm-dialog-content">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          {children}
        </div>

        <div className="confirm-dialog-actions">
          <button
            className="secondary-action"
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`confirm-dialog-confirm confirm-dialog-confirm--${variant}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
