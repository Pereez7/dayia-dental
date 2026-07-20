import { useEffect, useId, useRef, type ReactNode } from 'react'

export type ConfirmDialogVariant = 'danger' | 'info' | 'warning'

interface ConfirmDialogProps {
  cancelLabel: string
  children?: ReactNode
  confirmLabel: string
  confirmFormId?: string
  confirmType?: 'button' | 'submit'
  isOpen: boolean
  isCancelDisabled?: boolean
  isConfirmDisabled?: boolean
  message: string
  size?: 'default' | 'wide'
  title: string
  variant: ConfirmDialogVariant
  onCancel: () => void
  onConfirm?: () => void
}

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  confirmFormId,
  confirmType = 'button',
  isOpen,
  isCancelDisabled = false,
  isConfirmDisabled = false,
  message,
  size = 'default',
  title,
  variant,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocusedElement = document.activeElement

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = getDialogFocusableElements(dialogRef.current)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    cancelButtonRef.current?.focus()
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)

      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="confirm-dialog-overlay">
      <div
        aria-describedby={messageId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`confirm-dialog confirm-dialog--${variant}${
          size === 'wide' ? ' confirm-dialog--wide' : ''
        }`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="confirm-dialog-content">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          {children}
        </div>

        <div className="confirm-dialog-actions">
          <button
            className="secondary-action"
            disabled={isCancelDisabled}
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`confirm-dialog-confirm confirm-dialog-confirm--${variant}`}
            disabled={isConfirmDisabled}
            form={confirmFormId}
            type={confirmType}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function getDialogFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  )
}
