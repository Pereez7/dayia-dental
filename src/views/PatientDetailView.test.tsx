import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { appointments } from '../data/appointments'
import { clinicalRecords } from '../data/clinicalRecords'
import { odontogramEntries } from '../data/odontogram'
import { patients } from '../data/patients'
import { PatientDetailView } from './PatientDetailView'

describe('PatientDetailView permissions', () => {
  it('does not render sensitive clinical blocks for reception', () => {
    const markup = renderToStaticMarkup(
      <PatientDetailView
        appointments={appointments}
        canAccessClinicalHistory={false}
        canAccessOdontogram={false}
        clinicalRecords={clinicalRecords}
        odontogramEntries={odontogramEntries}
        patient={patients[0]}
        onBackToList={vi.fn()}
        onCreateClinicalRecord={vi.fn()}
        onSaveOdontogramTooth={vi.fn()}
      />,
    )

    expect(markup).not.toContain('Historial clínico')
    expect(markup).not.toContain('Odontograma')
    expect(markup).toContain('Agenda del paciente')
    expect(markup).not.toContain('Ver historial clínico')
    expect(markup).not.toContain('Ver odontograma')
  })

  it('shows permitted quick actions and all patient appointments', () => {
    const markup = renderToStaticMarkup(
      <PatientDetailView
        appointments={appointments}
        canAccessClinicalHistory
        canAccessOdontogram
        clinicalRecords={clinicalRecords}
        odontogramEntries={odontogramEntries}
        patient={patients[0]}
        onBackToList={vi.fn()}
        onCreateAppointment={vi.fn()}
        onCreateClinicalRecord={vi.fn()}
        onSaveOdontogramTooth={vi.fn()}
      />,
    )

    expect(markup).toContain('Nueva cita')
    expect(markup).toContain('Ver historial clínico')
    expect(markup).toContain('Ver odontograma')
    expect(markup).toContain('Citas del paciente')
  })

  it('shows patient editing only when patient management is allowed', () => {
    const editableMarkup = renderToStaticMarkup(
      <PatientDetailView
        appointments={appointments}
        canAccessClinicalHistory={false}
        canAccessOdontogram={false}
        canEditPatient
        clinicalRecords={clinicalRecords}
        odontogramEntries={odontogramEntries}
        patient={patients[0]}
        patients={patients}
        onBackToList={vi.fn()}
        onCreateClinicalRecord={vi.fn()}
        onSaveOdontogramTooth={vi.fn()}
        onUpdatePatient={vi.fn()}
      />,
    )
    const readOnlyMarkup = renderToStaticMarkup(
      <PatientDetailView
        appointments={appointments}
        canAccessClinicalHistory={false}
        canAccessOdontogram={false}
        clinicalRecords={clinicalRecords}
        odontogramEntries={odontogramEntries}
        patient={patients[0]}
        onBackToList={vi.fn()}
        onCreateClinicalRecord={vi.fn()}
        onSaveOdontogramTooth={vi.fn()}
      />,
    )

    expect(editableMarkup).toContain('Editar datos')
    expect(readOnlyMarkup).not.toContain('Editar datos')
  })
})
