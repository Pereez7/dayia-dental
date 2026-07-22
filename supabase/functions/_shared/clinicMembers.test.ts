import { describe, expect, it } from 'vitest'

import {
  assertMembershipLimit,
  assertNoClinicMembership,
  clinicMemberAvailableSubscriptionStatuses,
  ClinicMemberError,
  getManagedPlanLimit,
  isCountedMembershipStatus,
  normalizeInviteClinicMemberPayload,
  normalizePersonName,
} from './clinicMembers'

describe('clinic member Edge Function rules', () => {
  it('normalizes a valid invitation', () => {
    expect(
      normalizeInviteClinicMemberPayload({
        email: '  DRA@CLINICA.COM ',
        fullName: ' Dra.   Andrea Vaca ',
        role: 'doctor',
      }),
    ).toEqual({
      email: 'dra@clinica.com',
      fullName: 'Dra. Andrea Vaca',
      role: 'doctor',
    })
  })

  it('normalizes member names without treating surnames as sentence text', () => {
    expect(normalizePersonName('Fabricio pérez suarez')).toBe(
      'Fabricio Pérez Suarez',
    )
    expect(normalizePersonName('MARÍA DEL CARMEN DE LA CRUZ')).toBe(
      'María del Carmen de la Cruz',
    )
  })

  it.each(['clinic_owner', 'platform_admin', 'unknown']) (
    'rejects the non-invitable role %s',
    (role) => {
      expect(() =>
        normalizeInviteClinicMemberPayload({
          email: 'user@clinic.com',
          fullName: 'Usuario válido',
          role,
        }),
      ).toThrowError(expect.objectContaining({ code: 'INVALID_ROLE' }))
    },
  )

  it('blocks Basic and keeps the server limits for Medium and Pro', () => {
    expect(() => getManagedPlanLimit('basic', 1)).toThrowError(
      expect.objectContaining({ code: 'PLAN_NOT_ELIGIBLE' }),
    )
    expect(getManagedPlanLimit('medium', 99)).toBe(4)
    expect(getManagedPlanLimit('pro', 99)).toBe(10)
  })

  it('allows user management during a modern trial subscription', () => {
    expect(clinicMemberAvailableSubscriptionStatuses).toEqual([
      'trial',
      'trialing',
      'active',
    ])
    expect(clinicMemberAvailableSubscriptionStatuses).not.toContain('past_due')
    expect(clinicMemberAvailableSubscriptionStatuses).not.toContain('blocked')
  })

  it.each([
    ['medium', 4],
    ['pro', 10],
  ])('blocks %s at its member limit', (planId, currentCount) => {
    expect(() =>
      assertMembershipLimit({ currentCount, maxUsers: currentCount, planId }),
    ).toThrowError(expect.objectContaining({ code: 'MEMBER_LIMIT_REACHED' }))
  })

  it('returns a conflict for an existing membership in the same clinic', () => {
    expect(() => assertNoClinicMembership(true)).toThrowError(
      expect.objectContaining({ code: 'MEMBERSHIP_ALREADY_EXISTS', status: 409 }),
    )
    expect(() => assertNoClinicMembership(false)).not.toThrow()
  })

  it('allows a user from another clinic when no same-clinic membership exists', () => {
    expect(() => assertNoClinicMembership(false)).not.toThrow()
  })

  it('counts active and pending memberships but not inactive ones', () => {
    expect(isCountedMembershipStatus('active')).toBe(true)
    expect(isCountedMembershipStatus('pending_activation')).toBe(true)
    expect(isCountedMembershipStatus('pending')).toBe(true)
    expect(isCountedMembershipStatus('inactive')).toBe(false)
  })

  it('uses controlled public errors', () => {
    const error = new ClinicMemberError('FORBIDDEN', 'Sin permiso.', 403)
    expect(error).toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })
})
