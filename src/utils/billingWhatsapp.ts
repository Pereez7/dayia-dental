interface BillingWhatsappMessageInput {
  amount: number
  billingCycleLabel: string
  clinicName: string
  currency: string
  phone: string | null | undefined
  planName: string
}

export function buildBillingWhatsappUrl({
  amount,
  billingCycleLabel,
  clinicName,
  currency,
  phone,
  planName,
}: BillingWhatsappMessageInput) {
  const normalizedPhone = normalizeWhatsappPhone(phone)

  if (!normalizedPhone || !Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const message = [
    'Hola, realicé el pago de mi suscripción de DayIA Dental.',
    `Consultorio: ${clinicName}`,
    `Plan: ${planName}`,
    `Periodo: ${billingCycleLabel}`,
    `Monto: ${amount.toFixed(2)} ${currency}`,
    'Adjunto el comprobante para su validación.',
  ].join('\n')

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export function normalizeWhatsappPhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}
