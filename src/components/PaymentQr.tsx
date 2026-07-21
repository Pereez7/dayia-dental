import { useState } from 'react'

import { getPlanQrPath } from '../utils/subscriptionBilling'

interface PaymentQrProps {
  planId: string | null
  planName: string | null
}

export function PaymentQr({ planId, planName }: PaymentQrProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null)
  const path = getPlanQrPath(planId)

  if (!path || failedPath === path) {
    return (
      <div className="payment-qr-placeholder" role="status">
        <strong>QR pendiente de configurar</strong>
        <span>Agrega la imagen del plan {planName ?? 'seleccionado'}.</span>
      </div>
    )
  }

  return (
    <img
      alt={`Código QR para pagar el plan ${planName ?? planId}`}
      className="payment-qr-image"
      onError={() => setFailedPath(path)}
      src={path}
    />
  )
}
