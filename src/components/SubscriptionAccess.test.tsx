import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Clinic, ClinicSubscriptionRecord } from '../types/database'
import {
  SubscriptionBlockedView,
  SubscriptionMembershipView,
} from './SubscriptionAccess'
import { SubscriptionNotice } from './SubscriptionNotice'

const clinic: Clinic = {
  country_code: '+591',
  created_at: '2026-07-01T00:00:00.000Z',
  id: 'clinic-1',
  name: 'Clínica Norte',
  phone: null,
  updated_at: '2026-07-01T00:00:00.000Z',
}

describe('SubscriptionAccess', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows only the QR that belongs to the current plan', () => {
    vi.stubEnv('VITE_DAYIA_BILLING_WHATSAPP', '59170000000')
    const markup = renderToStaticMarkup(
      <SubscriptionBlockedView
        canSubmitPayment
        clinic={clinic}
        currency="BOB"
        monthlyPrice={200}
        planId="medium"
        submittedByUserId="owner-1"
        subscription={null}
      />,
    )

    expect(markup).toContain('/payment-qr/medium.png')
    expect(markup).not.toContain('/payment-qr/basic.png')
    expect(markup).not.toContain('/payment-qr/pro.png')
    expect(markup).toContain('Tu sesión y tus datos siguen disponibles')
    expect(markup).toContain('1 mes')
    expect(markup).toContain('6 meses')
    expect(markup).toContain('12 meses')
    expect(markup).toContain('Enviar comprobante por WhatsApp')
    expect(markup).toContain('wa.me/59170000000')
    expect(markup).not.toContain('Referencia del comprobante')
  })

  it('does not show expiration notices for lifetime access', () => {
    const subscription = {
      current_period_ends_at: null,
      grace_ends_at: null,
      is_lifetime: true,
      status: 'lifetime',
      trial_ends_at: null,
    } as ClinicSubscriptionRecord

    expect(
      renderToStaticMarkup(<SubscriptionNotice subscription={subscription} />),
    ).toBe('')
  })

  it('presents lifetime access as a permanent premium membership', () => {
    const subscription = {
      current_period_ends_at: null,
      grace_ends_at: null,
      is_lifetime: true,
      price_tier: 'founder',
      status: 'lifetime',
      trial_ends_at: null,
    } as ClinicSubscriptionRecord

    const markup = renderToStaticMarkup(
      <SubscriptionMembershipView
        canSubmitPayment
        clinic={clinic}
        currency="BOB"
        monthlyPrice={249}
        planId="pro"
        submittedByUserId="owner-1"
        subscription={subscription}
      />,
    )

    expect(markup).toContain('subscription-membership-view--lifetime')
    expect(markup).toContain('Acceso vitalicio de Clínica Norte')
    expect(markup).toContain('Tu acceso permanece activo, sin renovaciones.')
    expect(markup).toContain('Permanente')
    expect(markup).toContain('No requerida')
    expect(markup).toContain('Licencia protegida.')
    expect(markup).not.toContain('Elige un periodo')
    expect(markup).not.toContain('Pago por QR')
  })

  it('identifies founder pricing in every renewal option', () => {
    const subscription = {
      current_period_ends_at: '2026-08-21T00:00:00.000Z',
      grace_ends_at: '2026-08-26T00:00:00.000Z',
      is_lifetime: false,
      price_tier: 'founder',
      status: 'active',
      trial_ends_at: null,
    } as ClinicSubscriptionRecord

    const markup = renderToStaticMarkup(
      <SubscriptionBlockedView
        canSubmitPayment
        clinic={clinic}
        currency="BOB"
        monthlyPrice={249}
        planId="pro"
        standardMonthlyPrice={299}
        submittedByUserId="owner-1"
        subscription={subscription}
      />,
    )

    expect(markup).toContain('Tarifa fundador')
    expect(markup).toContain('10% de descuento')
    expect(markup).toContain('1614.60 BOB')
    expect(markup).toContain('2870.40 BOB')
    expect(markup).not.toContain('Sin descuento')
  })
})
