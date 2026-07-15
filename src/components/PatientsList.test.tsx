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
})
