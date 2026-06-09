import { describe, expect, it } from 'vitest'
import { formatCompactDateWithYear } from './dateFormatters'

describe('formatCompactDateWithYear', () => {
  it('formats a date with day, short month and year', () => {
    expect(formatCompactDateWithYear('2026-06-09')).toBe('09-jun-2026')
  })
})
