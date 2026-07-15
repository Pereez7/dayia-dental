import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { businessHours } from '../data/businessHours'
import { patients } from '../data/patients'
import { treatments } from '../data/treatments'
import { AppointmentForm } from './AppointmentForm'

describe('AppointmentForm patient context', () => {
  it('preselects the patient when the flow starts from patient detail', () => {
    const markup = renderToStaticMarkup(
      <AppointmentForm
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        initialPatient={patients[0]}
        onCancel={vi.fn()}
        onCreateAppointment={vi.fn()}
        patients={patients}
        treatments={treatments}
      />,
    )

    expect(markup).toContain(`Paciente seleccionado: ${patients[0].fullName}`)
  })
})
