import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Clinic, ClinicSubscriptionRecord } from '../types/database'
import { SubscriptionBlockedView, SubscriptionNotice } from './SubscriptionAccess'

const clinic: Clinic = {
  country_code: '+591',
  created_at: '2026-07-01T00:00:00.000Z',
  id: 'clinic-1',
  name: 'Clínica Norte',
  phone: null,
  updated_at: '2026-07-01T00:00:00.000Z',
}

describe('SubscriptionAccess', () => {
  it('shows only the QR that belongs to the current plan', () => {
    const markup = renderToStaticMarkup(
      <SubscriptionBlockedView
        clinic={clinic}
        currency="BOB"
        monthlyPrice={200}
        planId="medium"
      />,
    )

    expect(markup).toContain('/payment-qr/medium.png')
    expect(markup).not.toContain('/payment-qr/basic.png')
    expect(markup).not.toContain('/payment-qr/pro.png')
    expect(markup).toContain('Tu sesión continúa abierta')
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
})
