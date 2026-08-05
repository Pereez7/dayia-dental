import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { PatientsList } from './PatientsList'

describe('PatientsList empty state', () => {
  it('shows a useful registration action when the clinic has no patients', () => {
    const markup = renderToStaticMarkup(
      <PatientsList onViewPatient={vi.fn()} patients={[]} />,
    )

    expect(markup).toContain('Aún no hay pacientes registrados')
    expect(markup).toContain('Registrar paciente')
  })

  it('shows one non-blocking load-more action for a partial server page', () => {
    const markup = renderToStaticMarkup(
      <PatientsList
        hasMore
        isServerPaginated
        onLoadMore={vi.fn()}
        onViewPatient={vi.fn()}
        patients={[
          {
            id: 'patient-1',
            fullName: 'Ana Salazar',
            lastVisit: 'Sin registro',
            nextAppointment: null,
            phone: '+59176543210',
            status: 'active',
          },
        ]}
      />,
    )

    expect(markup).toContain('Ana Salazar')
    expect(markup).toContain('Cargar más pacientes')
  })
})
