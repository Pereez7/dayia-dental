import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog accessibility', () => {
  it('exposes modal semantics and a programmatic focus target', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel="Confirmar acción"
        isOpen
        message="Revisa los datos antes de continuar."
        title="Confirmar"
        variant="warning"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('tabindex="-1"')
  })
})
