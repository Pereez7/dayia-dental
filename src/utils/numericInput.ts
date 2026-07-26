export type NumericInputKind = 'decimal' | 'integer'

export function sanitizeNumericInput(
  value: string,
  {
    decimalPlaces = 2,
    kind = 'integer',
  }: {
    decimalPlaces?: number
    kind?: NumericInputKind
  } = {},
) {
  const normalizedValue = value.replace(',', '.')

  if (kind === 'integer') {
    return normalizeWholeNumber(normalizedValue.replace(/\D/g, ''))
  }

  const decimalSeparatorIndex = normalizedValue.indexOf('.')
  const hasDecimalSeparator = decimalSeparatorIndex >= 0
  const wholeSource = hasDecimalSeparator
    ? normalizedValue.slice(0, decimalSeparatorIndex)
    : normalizedValue
  const decimalSource = hasDecimalSeparator
    ? normalizedValue.slice(decimalSeparatorIndex + 1)
    : ''
  const whole = normalizeWholeNumber(wholeSource.replace(/\D/g, ''))
  const decimals = decimalSource
    .replace(/\D/g, '')
    .slice(0, Math.max(0, decimalPlaces))

  if (!hasDecimalSeparator) return whole
  return `${whole || '0'}.${decimals}`
}

export function parseNumericInput(value: string) {
  if (!value.trim()) return null

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function formatNumericInput(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? ''
    : String(value)
}

function normalizeWholeNumber(value: string) {
  if (!value) return ''
  return value.replace(/^0+(?=\d)/, '')
}
