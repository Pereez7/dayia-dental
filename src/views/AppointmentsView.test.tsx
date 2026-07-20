import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { businessHours } from '../data/businessHours'
import { AppointmentsView } from './AppointmentsView'

describe('AppointmentsView loading states', () => {
  it('does not mount the appointment form before real settings are ready', () => {
    const markup = renderToStaticMarkup(
      <AppointmentsView
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        isSettingsLoading
        mode="new"
        onCreateAppointment={vi.fn()}
        patients={[]}
        treatments={[]}
      />,
    )

    expect(markup).toContain('Preparando la agenda...')
    expect(markup).not.toContain('Guardar cita')
    expect(markup).not.toContain('Seleccionar tratamiento')
  })
})
