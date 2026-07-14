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
  })
})
