import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Patient } from '../types/Patient'
import { PatientCard } from './PatientCard'

const patient: Patient = {
  id: 'patient-1',
  fullName: 'Ana Pérez',
  lastVisit: 'Sin registro',
  nextAppointment: null,
  phone: '+59170000000',
  status: 'active',
}

describe('PatientCard editing', () => {
  it('shows editing only when an edit callback is provided', () => {
    const editableMarkup = renderToStaticMarkup(
      <PatientCard
        patient={patient}
        onEdit={vi.fn()}
        onViewDetail={vi.fn()}
      />,
    )
    const readOnlyMarkup = renderToStaticMarkup(
      <PatientCard patient={patient} onViewDetail={vi.fn()} />,
    )

    expect(editableMarkup).toContain('Editar')
    expect(readOnlyMarkup).not.toContain('>Editar<')
  })
})
