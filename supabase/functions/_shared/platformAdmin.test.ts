import { describe, expect, it } from 'vitest'

import {
  normalizeSubscriptionStatus,
  resolveClinicStatus,
  selectPrimaryOwner,
  type OwnerMembershipCandidate,
  type OwnerProfileCandidate,
} from './platformAdmin'

describe('platform admin Edge Function helpers', () => {
  it('keeps an explicit active clinic status', () => {
    expect(resolveClinicStatus('active', null)).toBe('active')
  })

  it('uses an active subscription when clinic status is empty', () => {
    expect(resolveClinicStatus(null, 'active')).toBe('active')
    expect(resolveClinicStatus('  ', 'active')).toBe('active')
  })

  it('uses pending activation without a clinic status or active subscription', () => {
    expect(resolveClinicStatus(null, 'trial')).toBe('pending_activation')
  })

  it('returns no owner when there is no active owner candidate', () => {
    expect(selectPrimaryOwner([], new Map())).toBeNull()
  })

  it('maps the selected owner profile', () => {
    const memberships = [membership('owner-1', '2026-06-01', '2026-01-01')]
    const profiles = new Map<string, OwnerProfileCandidate>([
      [
        'owner-1',
        {
          email: 'owner@clinic.com',
          full_name: 'Dra. Andrea',
          id: 'owner-1',
        },
      ],
    ])

    expect(selectPrimaryOwner(memberships, profiles)).toEqual({
      email: 'owner@clinic.com',
      fullName: 'Dra. Andrea',
      invitationSentAt: null,
      membershipStatus: 'active',
      userId: 'owner-1',
    })
  })

  it('prefers an active owner over a pending invitation', () => {
    const memberships = [
      membership(
        'pending-owner',
        null,
        '2026-07-20',
        'pending_activation',
        '2026-07-20',
      ),
      membership('active-owner', '2026-06-01', '2026-06-01'),
    ]
    const profiles = new Map<string, OwnerProfileCandidate>([
      [
        'pending-owner',
        {
          email: 'pending@dayia.com',
          full_name: 'Propietaria pendiente',
          id: 'pending-owner',
        },
      ],
      [
        'active-owner',
        {
          email: 'active@dayia.com',
          full_name: 'Propietaria activa',
          id: 'active-owner',
        },
      ],
    ])

    expect(selectPrimaryOwner(memberships, profiles)?.userId).toBe(
      'active-owner',
    )
  })

  it('prefers a real email and then uses stable membership dates', () => {
    const memberships = [
      membership('temporary', '2026-07-10', '2026-07-10'),
      membership('older-real', '2026-06-01', '2026-06-01'),
      membership('newer-real', '2026-07-01', '2026-05-01'),
    ]
    const profiles = new Map<string, OwnerProfileCandidate>([
      [
        'temporary',
        {
          email: 'charles@test.com',
          full_name: 'Charles temporal',
          id: 'temporary',
        },
      ],
      [
        'older-real',
        {
          email: 'older@dayia.com',
          full_name: 'Owner anterior',
          id: 'older-real',
        },
      ],
      [
        'newer-real',
        {
          email: 'pereezcharles@gmail.com',
          full_name: 'Charles Pérez',
          id: 'newer-real',
        },
      ],
    ])

    expect(selectPrimaryOwner(memberships, profiles)?.userId).toBe('newer-real')
  })

  it('normalizes legacy database subscription statuses', () => {
    expect(normalizeSubscriptionStatus('trial')).toBe('trialing')
    expect(normalizeSubscriptionStatus('cancelled')).toBe('canceled')
  })
})

function membership(
  userId: string,
  activatedAt: string | null,
  createdAt: string,
  status = 'active',
  invitedAt: string | null = null,
): OwnerMembershipCandidate {
  return {
    activated_at: activatedAt,
    clinic_id: 'clinic-1',
    created_at: createdAt,
    invited_at: invitedAt,
    status,
    user_id: userId,
  }
}
