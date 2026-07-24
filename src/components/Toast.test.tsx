import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Toast } from './Toast'

describe('Toast', () => {
  it('announces successful actions without depending on page position', () => {
    const markup = renderToStaticMarkup(
      <Toast
        message="Suscripción actualizada correctamente."
        tone="success"
        visible
      />,
    )

    expect(markup).toContain('class="toast toast--success"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Confirmación')
    expect(markup).toContain('Suscripción actualizada correctamente.')
  })

  it('announces errors assertively', () => {
    const markup = renderToStaticMarkup(
      <Toast message="No pudimos guardar el cambio." tone="error" visible />,
    )

    expect(markup).toContain('class="toast toast--error"')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Error')
  })
})
