import { describe, expect, it } from 'vitest'
import {
  formatCompactDateWithYear,
  formatOptionalCompactDateWithYear,
} from './dateFormatters'

describe('formatCompactDateWithYear', () => {
  it('formats a date with day, short month and year', () => {
    expect(formatCompactDateWithYear('2026-06-09')).toBe('09-jun-2026')
  })
})

describe('formatOptionalCompactDateWithYear', () => {
  it('formats valid dates and returns fallback for missing values', () => {
    expect(formatOptionalCompactDateWithYear('2026-05-18')).toBe('18-may-2026')
    expect(formatOptionalCompactDateWithYear(null)).toBe('Sin registro')
    expect(formatOptionalCompactDateWithYear(undefined, 'Sin cita')).toBe(
      'Sin cita',
    )
  })

  it('returns fallback for non-date values', () => {
    expect(formatOptionalCompactDateWithYear('Sin registro')).toBe(
      'Sin registro',
    )
  })
})
