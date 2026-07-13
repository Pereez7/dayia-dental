import { describe, expect, it } from 'vitest'

import {
  getPlatformClinicStatusLabel,
  getPlatformSubscriptionStatusLabel,
} from './platformStatusLabels'

describe('platform status labels', () => {
  it('maps clinic statuses to Spanish', () => {
    expect(getPlatformClinicStatusLabel('active')).toBe('Activa')
    expect(getPlatformClinicStatusLabel('pending_activation')).toBe('Pendiente')
    expect(getPlatformClinicStatusLabel('suspended')).toBe('Suspendida')
    expect(getPlatformClinicStatusLabel('unknown')).toBe('Estado no definido')
  })

  it('maps subscription statuses to Spanish', () => {
    expect(getPlatformSubscriptionStatusLabel('active')).toBe('Activa')
    expect(getPlatformSubscriptionStatusLabel('trialing')).toBe('En prueba')
    expect(getPlatformSubscriptionStatusLabel('past_due')).toBe(
      'Pago pendiente',
    )
    expect(getPlatformSubscriptionStatusLabel('canceled')).toBe('Cancelada')
    expect(getPlatformSubscriptionStatusLabel('unknown')).toBe('Sin estado')
  })
})
