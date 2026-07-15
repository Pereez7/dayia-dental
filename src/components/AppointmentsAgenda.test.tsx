import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { businessHours } from '../data/businessHours'
import { AppointmentsAgenda } from './AppointmentsAgenda'

describe('AppointmentsAgenda empty state', () => {
  it('shows a create appointment action when the role can create', () => {
    const markup = renderToStaticMarkup(
      <AppointmentsAgenda
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        onCreateAppointment={vi.fn()}
        patients={[]}
        treatments={[]}
      />,
    )

    expect(markup).toContain('No hay citas programadas para este día')
    expect(markup).toContain('Crear cita')
  })

  it('hides the create action when it is not available', () => {
    const markup = renderToStaticMarkup(
      <AppointmentsAgenda
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        patients={[]}
        treatments={[]}
      />,
    )

    expect(markup).not.toContain('Crear cita')
  })
})
