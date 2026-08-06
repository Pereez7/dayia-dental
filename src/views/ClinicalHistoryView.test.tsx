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

  it('renders bounded server summaries and a load-more action', () => {
    const record = {
      date: '2026-08-05',
      diagnosis: 'Gingivitis',
      hasPatient: true,
      id: 'record-1',
      notes: '',
      patientId: 'patient-1',
      patientName: '',
      patientPhone: '',
      reason: 'Control',
      treatment: 'Profilaxis',
    }
    const markup = renderToStaticMarkup(
      <ClinicalHistoryView
        clinicalRecords={[]}
        hasMore
        isServerPaginated
        onLoadMore={vi.fn()}
        patients={[]}
        serverGroups={[
          {
            hasPatient: true,
            latestRecord: record,
            matchingRecords: [record],
            patientId: 'patient-1',
            patientName: 'Paciente Uno',
            patientPhone: '+59170000001',
            records: [record],
            totalRecords: 7,
          },
        ]}
        serverSummary={{
          patientsWithHistory: 5,
          recordsThisMonth: 12,
          totalRecords: 30,
        }}
        onViewPatient={vi.fn()}
      />,
    )

    expect(markup).toContain('>30<')
    expect(markup).toContain('>12<')
    expect(markup).toContain('>5<')
    expect(markup).toContain('Cargar más pacientes')
    expect(markup).toContain('7 registros clínicos')
  })
})
