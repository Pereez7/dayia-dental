import { describe, expect, it } from 'vitest'

import { getClinicalPermissions } from '../auth/permissions'
import {
  getAuthorizedSection,
  getVisibleNavigationItems,
  getVisibleQuickActions,
  isSensitiveSectionAccessDenied,
} from './navigation'

describe('permission-aware navigation', () => {
  it('hides clinical history and odontogram from reception', () => {
    const permissions = getClinicalPermissions('receptionist', 'pro')
    const sectionIds = getVisibleNavigationItems(permissions, false).map(
      (item) => item.id,
    )

    expect(sectionIds).not.toContain('clinical-history')
    expect(sectionIds).not.toContain('odontogram')
    expect(sectionIds).not.toContain('settings')
    expect(sectionIds).toContain('whatsapp-reminders')
    expect(sectionIds).toEqual([
      'dashboard',
      'patients-list',
      'appointments-agenda',
      'whatsapp-reminders',
    ])
  })

  it('shows only Administration DayIA to platform admins', () => {
    const permissions = getClinicalPermissions('platform_admin', 'pro')

    expect(getVisibleNavigationItems(permissions, true)).toEqual([
      { id: 'administration', label: 'Administración DayIA' },
    ])
    expect(getVisibleQuickActions(permissions)).toEqual([])
  })

  it('shows quick actions only when their workflows are allowed', () => {
    const clinicalActions = getVisibleQuickActions(
      getClinicalPermissions('doctor', 'basic'),
    )
    const unknownActions = getVisibleQuickActions(
      getClinicalPermissions('unknown', 'pro'),
    )

    expect(clinicalActions.map((action) => action.id)).toEqual([
      'patient-new',
      'appointment-new',
    ])
    expect(unknownActions).toEqual([])
  })

  it('redirects a forbidden sensitive view to Dashboard', () => {
    const permissions = getClinicalPermissions('receptionist', 'pro')

    expect(getAuthorizedSection('clinical-history', permissions, false)).toBe(
      'dashboard',
    )
    expect(getAuthorizedSection('odontogram', permissions, false)).toBe(
      'dashboard',
    )
    expect(getAuthorizedSection('settings', permissions, false)).toBe(
      'dashboard',
    )
    expect(getAuthorizedSection('administration', permissions, false)).toBe(
      'dashboard',
    )
  })

  it('shows controlled denial for direct sensitive view attempts', () => {
    const permissions = getClinicalPermissions('receptionist', 'pro')

    for (const section of [
      'clinical-history',
      'odontogram',
      'settings',
      'administration',
    ] as const) {
      expect(
        isSensitiveSectionAccessDenied(section, permissions, false),
      ).toBe(true)
    }
  })

  it('allows doctors to open history and odontogram', () => {
    const permissions = getClinicalPermissions('doctor', 'basic')

    expect(getAuthorizedSection('clinical-history', permissions, false)).toBe(
      'clinical-history',
    )
    expect(getAuthorizedSection('odontogram', permissions, false)).toBe(
      'odontogram',
    )
  })

  it('allows clinic owners to open settings', () => {
    const permissions = getClinicalPermissions('clinic_owner', 'basic')

    expect(getAuthorizedSection('settings', permissions, false)).toBe(
      'settings',
    )
    expect(
      isSensitiveSectionAccessDenied('settings', permissions, false),
    ).toBe(false)
  })

  it('keeps pure platform admins away from clinical views', () => {
    const permissions = getClinicalPermissions('platform_admin', 'pro')

    expect(
      isSensitiveSectionAccessDenied(
        'clinical-history',
        permissions,
        true,
      ),
    ).toBe(true)
    expect(
      isSensitiveSectionAccessDenied('odontogram', permissions, true),
    ).toBe(true)
  })
})
