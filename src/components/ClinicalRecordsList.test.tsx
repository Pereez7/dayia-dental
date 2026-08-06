import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ClinicalRecordsList } from './ClinicalRecordsList'

describe('ClinicalRecordsList bounded pages', () => {
  it('uses the exact server summary and exposes the next page action', () => {
    const markup = renderToStaticMarkup(
      <ClinicalRecordsList
        hasMore
        onLoadMore={vi.fn()}
        records={[
          {
            date: '2026-08-05',
            diagnosis: 'Gingivitis',
            id: 'record-1',
            notes: 'Control en siete días',
            patientId: 'patient-1',
            reason: 'Control',
            treatment: 'Profilaxis',
          },
        ]}
        summary={{
          firstRecordDate: '2025-01-10',
          lastRecordDate: '2026-08-05',
          totalRecords: 18,
        }}
      />,
    )

    expect(markup).toContain('18 registros')
    expect(markup).toContain('Cargar más registros')
    expect(markup).not.toContain('1 registro clínico')
  })

  it('blocks another page request while the current one is loading', () => {
    const markup = renderToStaticMarkup(
      <ClinicalRecordsList
        hasMore
        isLoadingMore
        onLoadMore={vi.fn()}
        records={[
          {
            date: '2026-08-05',
            diagnosis: 'Gingivitis',
            id: 'record-1',
            notes: '',
            patientId: 'patient-1',
            reason: 'Control',
            treatment: 'Profilaxis',
          },
        ]}
      />,
    )

    expect(markup).toContain('Cargando registros...')
    expect(markup).toContain('disabled=""')
  })
})
