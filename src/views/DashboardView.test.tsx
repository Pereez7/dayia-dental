import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DashboardView } from './DashboardView'

describe('DashboardView', () => {
  it('shows loading placeholders without transient zero metrics or empty states', () => {
    const markup = renderToStaticMarkup(
      <DashboardView
        appointments={[]}
        isLoading
        patients={[]}
        referenceDate={new Date(2026, 6, 14, 9)}
      />,
    )

    expect(markup).toContain('dashboard-kpi-skeleton')
    expect(markup).toContain('Cargando próximas citas')
    expect(markup).not.toContain('>0<')
    expect(markup).not.toContain('No hay próximas atenciones')
    expect(markup).not.toContain('No hay pacientes registrados')
  })

  it('renders the bounded server snapshot instead of local collection totals', () => {
    const markup = renderToStaticMarkup(
      <DashboardView
        appointments={[]}
        data={{
          attentionItems: [],
          recentActivity: [],
          recentPatients: [],
          summary: {
            monthlyCancelledAppointments: 4,
            monthlyRescheduledAppointments: 3,
            registeredPatients: 120,
            todayAppointments: 8,
            todayConfirmedAppointments: 5,
            todayPendingAppointments: 2,
          },
          upcomingAppointments: [],
        }}
        patients={[]}
        referenceDate={new Date(2026, 7, 4, 9)}
      />,
    )

    expect(markup).toContain('>120<')
    expect(markup).toContain('>8<')
    expect(markup).toContain('>4<')
  })

  it('shows a visible error when the bounded snapshot cannot be loaded', () => {
    const markup = renderToStaticMarkup(
      <DashboardView
        appointments={[]}
        errorMessage="No pudimos cargar el resumen del consultorio."
        patients={[]}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('No pudimos cargar el resumen del consultorio.')
  })
})
