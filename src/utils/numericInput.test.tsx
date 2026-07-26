import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { NumericInput } from '../components/NumericInput'
import {
  formatNumericInput,
  parseNumericInput,
  sanitizeNumericInput,
} from './numericInput'

describe('numericInput', () => {
  it('allows an empty integer and removes leading zeros', () => {
    expect(sanitizeNumericInput('')).toBe('')
    expect(sanitizeNumericInput('0005')).toBe('5')
    expect(sanitizeNumericInput('01')).toBe('1')
    expect(sanitizeNumericInput('1a2-3')).toBe('123')
  })

  it('normalizes decimal input without accepting extra separators', () => {
    expect(
      sanitizeNumericInput('001,259', {
        decimalPlaces: 2,
        kind: 'decimal',
      }),
    ).toBe('1.25')
    expect(
      sanitizeNumericInput('12.3.4', {
        decimalPlaces: 2,
        kind: 'decimal',
      }),
    ).toBe('12.34')
    expect(
      sanitizeNumericInput('.', {
        decimalPlaces: 2,
        kind: 'decimal',
      }),
    ).toBe('0.')
  })

  it('parses only complete finite values', () => {
    expect(parseNumericInput('')).toBeNull()
    expect(parseNumericInput('249.50')).toBe(249.5)
    expect(formatNumericInput(null)).toBe('')
    expect(formatNumericInput(0)).toBe('0')
  })

  it('renders a text control with the appropriate mobile keyboard', () => {
    const markup = renderToStaticMarkup(
      <NumericInput onValueChange={vi.fn()} value="5" />,
    )

    expect(markup).toContain('type="text"')
    expect(markup).toContain('inputMode="numeric"')
    expect(markup).not.toContain('type="number"')
  })
})
