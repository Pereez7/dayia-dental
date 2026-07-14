import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { odontogramEntries } from '../data/odontogram'
import { patients } from '../data/patients'
import type { Patient } from '../types/Patient'
import {
  filterOdontogramPatients,
  findOdontogramPatientById,
  getOdontogramPatientSelection,
  syncOdontogramPatientSelection,
} from '../utils/odontogramPatientSearch'
import {
  OdontogramSearchResults,
  OdontogramView,
} from './OdontogramView'

const searchablePatients: Patient[] = [
  {
    ...patients[0],
    email: 'mariana@example.com',
    fullName: 'Mariana Pérez Rojas',
  },
  {
    ...patients[1],
    email: 'carlos@example.com',
  },
]

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
      'Selecciona un paciente de la lista para registrar su odontograma.',
    )
    expect(markup).not.toContain('Pieza 16, Restaurado')
  })

  it('filters partial matches by full name without accents or case', () => {
    expect(
      filterOdontogramPatients(searchablePatients, 'PEREZ roj'),
    ).toEqual([searchablePatients[0]])
  })

  it('filters patients by phone and email', () => {
    expect(
      filterOdontogramPatients(searchablePatients, '700123'),
    ).toEqual([searchablePatients[0]])
    expect(
      filterOdontogramPatients(searchablePatients, 'carlos@EXAMPLE'),
    ).toEqual([searchablePatients[1]])
  })

  it('synchronizes search text and selectedPatientId after choosing a result', () => {
    const updateSearchTerm = vi.fn()
    const onSelectPatient = vi.fn()

    syncOdontogramPatientSelection(
      searchablePatients[0],
      updateSearchTerm,
      onSelectPatient,
    )

    expect(updateSearchTerm).toHaveBeenCalledWith(
      searchablePatients[0].fullName,
    )
    expect(onSelectPatient).toHaveBeenCalledWith(searchablePatients[0].id)
  })

  it('resolves select values to the same patient selection flow', () => {
    const selectedPatient = findOdontogramPatientById(
      searchablePatients,
      String(searchablePatients[1].id),
    )

    expect(selectedPatient).toBe(searchablePatients[1])
    expect(
      selectedPatient && getOdontogramPatientSelection(selectedPatient),
    ).toEqual({
      patientId: searchablePatients[1].id,
      searchTerm: searchablePatients[1].fullName,
    })
  })

  it('shows a clear message when the autocomplete has no results', () => {
    const markup = renderToStaticMarkup(
      <OdontogramSearchResults
        onSelectPatient={vi.fn()}
        patients={[]}
        selectedPatientId={null}
      />,
    )

    expect(markup).toContain('No se encontraron pacientes.')
  })

  it('clearing search restores options without changing the active patient', () => {
    expect(filterOdontogramPatients(searchablePatients, '')).toEqual(
      searchablePatients,
    )

    const markup = renderToStaticMarkup(
      <OdontogramView
        entries={odontogramEntries}
        onSaveTooth={vi.fn()}
        onSelectPatient={vi.fn()}
        patients={patients}
        selectedPatientId={patients[1].id}
      />,
    )

    expect(markup).toContain(`Paciente seleccionado:`)
    expect(markup).toContain(patients[1].fullName)
    expect(markup).toContain('Pieza 16, Sano')
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
