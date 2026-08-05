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

  it('uses the server total and keeps arbitrary date navigation available', () => {
    const markup = renderToStaticMarkup(
      <AppointmentsAgenda
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        dayOptions={['2026-08-05', '2026-08-06']}
        patients={[]}
        selectedDate="2026-08-05"
        statusSummary={{
          cancelled: 1,
          completed: 2,
          confirmed: 12,
          no_show: 1,
          pending: 6,
          rescheduled: 3,
          total: 25,
        }}
        treatments={[]}
      />,
    )

    expect(markup).toContain('Ir a fecha')
    expect(markup).toContain('value="2026-08-05"')
    expect(markup).toContain('<strong>25</strong><span>Total</span>')
    expect(markup).toContain('<strong>12</strong><span>Confirmadas</span>')
  })

  it('shows one non-blocking load-more action for a partial day', () => {
    const markup = renderToStaticMarkup(
      <AppointmentsAgenda
        appointments={[
          {
            date: '2026-08-05',
            id: 'appointment-1',
            patient: 'Ana Salazar',
            patientPhone: '+59176543210',
            status: 'pending',
            time: '09:00',
            treatment: 'Control',
          },
        ]}
        businessHours={businessHours}
        calendarExceptions={[]}
        hasMore
        patients={[]}
        selectedDate="2026-08-05"
        treatments={[]}
      />,
    )

    expect(markup).toContain('Cargar más citas')
    expect(markup).toContain('+59176543210')
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
