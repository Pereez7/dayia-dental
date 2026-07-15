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
})
