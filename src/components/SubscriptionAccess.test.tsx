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

const planOptions = [
  {
    currency: 'BOB',
    founderMonthlyPrice: 79,
    id: 'basic' as const,
    monthlyPrice: 99,
    name: 'Basic',
  },
  {
    currency: 'BOB',
    founderMonthlyPrice: 149,
    id: 'medium' as const,
    monthlyPrice: 199,
    name: 'Medium',
  },
  {
    currency: 'BOB',
    founderMonthlyPrice: 249,
    id: 'pro' as const,
    monthlyPrice: 299,
    name: 'Pro',
  },
]

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

  it('presents every active plan before choosing the renewal period', () => {
    const subscription = {
      current_period_ends_at: '2026-08-21T00:00:00.000Z',
      grace_ends_at: '2026-08-26T00:00:00.000Z',
      is_lifetime: false,
      price_tier: 'standard',
      status: 'active',
      trial_ends_at: null,
    } as ClinicSubscriptionRecord

    const markup = renderToStaticMarkup(
      <SubscriptionMembershipView
        canSubmitPayment
        clinic={clinic}
        currency="BOB"
        monthlyPrice={199}
        planId="medium"
        planOptions={planOptions}
        submittedByUserId="owner-1"
        subscription={subscription}
      />,
    )

    expect(markup).toContain('Elige el plan')
    expect(markup).toContain('99.00 BOB / mes')
    expect(markup).toContain('199.00 BOB / mes')
    expect(markup).toContain('299.00 BOB / mes')
    expect(markup.match(/Plan actual/g)).toHaveLength(2)
  })

  it('shows a scheduled downgrade with a reversible action', () => {
    const subscription = {
      current_period_ends_at: '2026-09-21T00:00:00.000Z',
      grace_ends_at: '2026-09-26T00:00:00.000Z',
      is_lifetime: false,
      price_tier: 'standard',
      scheduled_plan_id: 'medium',
      scheduled_plan_starts_at: '2026-09-21T00:00:00.000Z',
      status: 'active',
      trial_ends_at: null,
    } as ClinicSubscriptionRecord

    const markup = renderToStaticMarkup(
      <SubscriptionMembershipView
        canSubmitPayment
        clinic={clinic}
        currency="BOB"
        monthlyPrice={299}
        planId="pro"
        planOptions={planOptions}
        submittedByUserId="owner-1"
        subscription={subscription}
      />,
    )

    expect(markup).toContain('Cambio programado a Medium')
    expect(markup).toContain('Cancelar cambio programado')
    expect(markup).toContain('Hasta entonces conservarás Pro')
    expect(markup).not.toContain('Elige el plan')
    expect(markup).not.toContain('Enviar comprobante por WhatsApp')
  })
})
