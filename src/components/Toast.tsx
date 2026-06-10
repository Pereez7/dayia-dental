export type ToastTone = 'error' | 'info' | 'success' | 'warning'

interface ToastProps {
  message: string
  onClose?: () => void
  tone?: ToastTone
  visible: boolean
}

const toastLabels: Record<ToastTone, string> = {
  error: 'Error',
  info: 'Información',
  success: 'Confirmación',
  warning: 'Aviso',
}

export function Toast({
  message,
  tone = 'info',
  visible,
}: ToastProps) {
  if (!message) {
    return null
  }

  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`toast toast--${tone}${visible ? '' : ' toast--exiting'}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="toast-content">
        <strong>{toastLabels[tone]}</strong>
        <p>{message}</p>
      </div>
    </div>
  )
}
