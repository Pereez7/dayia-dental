import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PatientFields } from './PatientFields'

describe('PatientFields phone prefix', () => {
  it('shows the manual prefix field for a code outside the frequent list', () => {
    const markup = renderToStaticMarkup(
      <form className="patient-form">
        <PatientFields
          errors={{}}
          idPrefix="test-patient"
          values={{
            birthDate: '',
            countryCode: '+49',
            email: '',
            firstName: 'Ana',
            lastName: 'Pérez',
            localPhone: '1701234567',
          }}
          onChange={vi.fn()}
        />
      </form>,
    )

    expect(markup).toContain('Otro')
    expect(markup).toContain('Prefijo internacional')
    expect(markup).toContain('value="+49"')
    expect(markup).toContain('value="1701234567"')
  })
})
