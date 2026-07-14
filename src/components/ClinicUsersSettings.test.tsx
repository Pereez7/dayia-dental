import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ClinicUsersSettings } from './ClinicUsersSettings'

const users = [
  {
    activatedAt: '2026-07-01T10:00:00.000Z',
    clinicId: 'clinic-1',
    createdAt: '2026-07-01T10:00:00.000Z',
    email: 'owner@clinic.com',
    fullName: 'Dra. Andrea Vaca',
    id: 'owner-1',
    invitedAt: null,
    role: 'clinic_owner' as const,
    status: 'active' as const,
  },
  {
    activatedAt: null,
    clinicId: 'clinic-1',
    createdAt: '2026-07-10T10:00:00.000Z',
    email: 'doctor@clinic.com',
    fullName: 'Dr. Luis Pérez',
    id: 'doctor-1',
    invitedAt: '2026-07-10T10:00:00.000Z',
    role: 'doctor' as const,
    status: 'pending_activation' as const,
  },
]

describe('ClinicUsersSettings', () => {
  it('shows membership roles, statuses and the plan counter', () => {
    const markup = renderToStaticMarkup(
      <ClinicUsersSettings
        canManageUsers
        maxUsers={4}
        memberCount={2}
        users={users}
        onCreateUser={vi.fn()}
      />,
    )

    expect(markup).toContain('Usuarios: <strong>2 de 4</strong>')
    expect(markup).toContain('Propietario del consultorio')
    expect(markup).toContain('Pendiente')
    expect(markup).toContain('Invitado el')
  })

  it.each([
    ['Medium', 4],
    ['Pro', 10],
  ])('disables invitations at the %s plan limit', (_, limit) => {
    const markup = renderToStaticMarkup(
      <ClinicUsersSettings
        canManageUsers
        maxUsers={limit}
        memberCount={limit}
        users={users}
        onCreateUser={vi.fn()}
      />,
    )

    expect(markup).toContain('Tu plan alcanzó el límite de usuarios.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Invitar usuario<\/button>/)
  })
})
