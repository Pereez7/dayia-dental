import { describe, expect, it } from 'vitest'

import {
  buildBillingWhatsappUrl,
  normalizeWhatsappPhone,
} from './billingWhatsapp'

describe('billing WhatsApp', () => {
  it('normalizes a public international phone number', () => {
    expect(normalizeWhatsappPhone('+591 700-00000')).toBe('59170000000')
    expect(normalizeWhatsappPhone('123')).toBeNull()
  })

  it('builds a message without asking the owner for a reference', () => {
    const url = buildBillingWhatsappUrl({
      amount: 239,
      billingCycleLabel: '1 mes',
      clinicName: 'Clínica Sopocachi',
      currency: 'BOB',
      phone: '+59170000000',
      planName: 'Pro',
    })

    expect(url).toContain('https://wa.me/59170000000?text=')
    expect(decodeURIComponent(url ?? '')).toContain('Monto: 239.00 BOB')
    expect(decodeURIComponent(url ?? '')).not.toContain('Referencia')
  })
})
