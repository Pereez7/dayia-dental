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

  it('restores a saved draft after returning from the agenda', () => {
    const draft = {
      patientId: patients[0].id,
      patient: patients[0].fullName,
      date: '2027-07-22',
      durationMinutes: treatments[0].durationMinutes,
      time: '15:00',
      treatment: treatments[0].name,
      status: 'pending' as const,
    }
    const markup = renderToStaticMarkup(
      <AppointmentForm
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        draft={draft}
        onCancel={vi.fn()}
        onCreateAppointment={vi.fn()}
        patients={patients}
        treatments={treatments}
      />,
    )

    expect(markup).toContain(`value="${patients[0].fullName}"`)
    expect(markup).toContain('value="2027-07-22"')
    expect(markup).toContain('<option value="15:00" selected="">')
    expect(markup).toContain(
      `<option value="${treatments[0].name}" selected="">`,
    )
  })
})
