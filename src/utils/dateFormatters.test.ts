import { describe, expect, it } from 'vitest'
import {
  formatClinicalHistoryDate,
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

describe('formatClinicalHistoryDate', () => {
  it('formats current-year clinical history dates without year', () => {
    expect(
      formatClinicalHistoryDate(
        '2026-06-12',
        new Date('2026-06-14T10:00:00'),
      ),
    ).toBe('12 jun')
  })

  it('includes the year when the clinical history date is outside the current year', () => {
    expect(
      formatClinicalHistoryDate(
        '2025-06-12',
        new Date('2026-06-14T10:00:00'),
      ),
    ).toBe('12 jun 2025')
  })

  it('formats clinical history dates with 24-hour time', () => {
    expect(
      formatClinicalHistoryDate(
        '2026-06-12T15:16:00',
        new Date('2026-06-14T10:00:00'),
      ),
    ).toBe('12 jun, 15:16')
  })

  it('handles invalid dates without throwing', () => {
    expect(formatClinicalHistoryDate('fecha-invalida')).toBe(
      'Fecha no disponible',
    )
  })
})
