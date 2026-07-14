import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ClinicalHistoryView } from './ClinicalHistoryView'

describe('ClinicalHistoryView states', () => {
  it('shows the loading state without showing the empty state', () => {
    const markup = renderToStaticMarkup(
      <ClinicalHistoryView
        clinicalRecords={[]}
        isLoading
        patients={[]}
        onViewPatient={vi.fn()}
      />,
    )

    expect(markup).toContain('Cargando historial clínico...')
    expect(markup).not.toContain('No hay registros clínicos todavía.')
  })

  it('shows the empty state after loading finishes', () => {
    const markup = renderToStaticMarkup(
      <ClinicalHistoryView
        clinicalRecords={[]}
        patients={[]}
        onViewPatient={vi.fn()}
      />,
    )

    expect(markup).toContain('No hay registros clínicos todavía.')
  })

  it('shows a friendly backend error', () => {
    const markup = renderToStaticMarkup(
      <ClinicalHistoryView
        clinicalRecords={[]}
        errorMessage="No tienes permiso para acceder al historial clínico."
        patients={[]}
        onViewPatient={vi.fn()}
      />,
    )

    expect(markup).toContain(
      'No tienes permiso para acceder al historial clínico.',
    )
  })
})
