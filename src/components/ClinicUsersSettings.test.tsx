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
    membershipId: 'membership-owner-1',
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
    membershipId: 'membership-doctor-1',
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
    expect(markup).toContain('Invitado el 10 jul')
    expect(markup).not.toContain('10/07/2026')
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

  it('offers reversible access actions only for active and inactive non-owners', () => {
    const activeDoctor = {
      ...users[1],
      activatedAt: '2026-07-12T10:00:00.000Z',
      status: 'active' as const,
    }
    const inactiveReceptionist = {
      ...users[1],
      email: 'recepcion@clinic.com',
      fullName: 'Ana Recepción',
      id: 'reception-1',
      membershipId: 'membership-reception-1',
      role: 'receptionist' as const,
      status: 'inactive' as const,
    }
    const markup = renderToStaticMarkup(
      <ClinicUsersSettings
        canManageUsers
        currentUserId="owner-1"
        maxUsers={4}
        memberCount={2}
        users={[users[0], activeDoctor, inactiveReceptionist]}
        onCreateUser={vi.fn()}
        onSetUserStatus={vi.fn()}
      />,
    )

    expect(markup).toContain('>Desactivar</button>')
    expect(markup).toContain('>Reactivar</button>')
    expect(markup).not.toContain('>Desactivar acceso</button>')
    expect(markup).not.toContain('>Reactivar acceso</button>')
  })

  it('blocks reactivation when the plan has no available seats', () => {
    const markup = renderToStaticMarkup(
      <ClinicUsersSettings
        canManageUsers
        currentUserId="owner-1"
        maxUsers={2}
        memberCount={2}
        users={[
          users[0],
          {
            ...users[1],
            status: 'inactive',
          },
        ]}
        onCreateUser={vi.fn()}
        onSetUserStatus={vi.fn()}
      />,
    )

    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Reactivar<\/button>/,
    )
    expect(markup).toContain('Libera un espacio del plan para reactivar.')
  })
})
