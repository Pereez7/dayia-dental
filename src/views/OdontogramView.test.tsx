import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { odontogramEntries } from '../data/odontogram'
import { patients } from '../data/patients'
import { OdontogramView } from './OdontogramView'

describe('OdontogramView states', () => {
  it('asks for a patient before rendering clinical data', () => {
    const markup = renderToStaticMarkup(
      <OdontogramView
        entries={odontogramEntries}
        onSaveTooth={vi.fn()}
        onSelectPatient={vi.fn()}
        patients={patients}
        selectedPatientId={null}
      />,
    )

    expect(markup).toContain(
      'Selecciona un paciente para registrar su odontograma.',
    )
    expect(markup).not.toContain('Pieza 16, Restaurado')
  })

  it('does not mix tooth states when the selected patient changes', () => {
    const markup = renderToStaticMarkup(
      <OdontogramView
        entries={odontogramEntries}
        onSaveTooth={vi.fn()}
        onSelectPatient={vi.fn()}
        patients={patients}
        selectedPatientId={patients[1].id}
      />,
    )

    expect(markup).toContain(patients[1].fullName)
    expect(markup).toContain('Pieza 16, Sano')
    expect(markup).not.toContain('Pieza 16, Restaurado')
  })

  it('shows a loading state without rendering the dental map', () => {
    const markup = renderToStaticMarkup(
      <OdontogramView
        entries={[]}
        isLoading
        onSaveTooth={vi.fn()}
        onSelectPatient={vi.fn()}
        patients={patients}
        selectedPatientId={patients[0].id}
      />,
    )

    expect(markup).toContain('Cargando odontograma de')
    expect(markup).not.toContain('Piezas dentales permanentes')
  })
})
