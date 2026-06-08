import { describe, expect, it } from 'vitest'
import type { Treatment } from '../types/Treatment'
import {
  filterTreatmentsBySearch,
  formatTreatmentName,
  getActiveTreatments,
  hasTreatmentName,
  normalizeTreatmentNameForComparison,
  validateTreatmentName,
} from './treatmentUtils'

const treatments: Treatment[] = [
  { id: 1, name: 'Limpieza dental', isActive: true },
  { id: 2, name: 'Evaluación inicial', isActive: false },
  { id: 3, name: 'Restauración / resina', isActive: true },
]

describe('treatmentUtils', () => {
  it('formats treatment names with consistent capitalization and spacing', () => {
    expect(formatTreatmentName('  LIMPIEZA    DentaL  ')).toBe(
      'Limpieza dental',
    )
    expect(formatTreatmentName('evaluación INICIAL')).toBe(
      'Evaluación inicial',
    )
  })

  it('normalizes names for comparison without accents or extra spaces', () => {
    expect(normalizeTreatmentNameForComparison('EVALUACIÓN   INICIAL')).toBe(
      'evaluacion inicial',
    )
  })

  it('filters active treatments', () => {
    expect(getActiveTreatments(treatments)).toEqual([
      treatments[0],
      treatments[2],
    ])
  })

  it('detects duplicated names ignoring case accents and spaces', () => {
    expect(hasTreatmentName(treatments, 'evaluacion    INICIAL')).toBe(true)
    expect(hasTreatmentName(treatments, 'LIMPIEZA dental')).toBe(true)
  })

  it('ignores the current treatment when checking duplicates while editing', () => {
    expect(hasTreatmentName(treatments, 'evaluacion inicial', 2)).toBe(false)
  })

  it('requires a treatment name', () => {
    expect(validateTreatmentName(treatments, '   ')).toBe(
      'Ingresa el nombre del tratamiento.',
    )
  })

  it('requires at least 3 characters', () => {
    expect(validateTreatmentName(treatments, 'AB')).toBe(
      'El tratamiento debe tener al menos 3 caracteres.',
    )
  })

  it('limits treatment names to 60 characters', () => {
    expect(validateTreatmentName(treatments, 'A'.repeat(61))).toBe(
      'El tratamiento no puede superar 60 caracteres.',
    )
  })

  it('allows only simple useful characters', () => {
    expect(validateTreatmentName(treatments, 'Limpieza #1')).toBe(
      'Usa solo letras, numeros, espacios y signos como /, -, ( ).',
    )
  })

  it('does not allow duplicated treatment names', () => {
    expect(validateTreatmentName(treatments, 'EVALUACION INICIAL')).toBe(
      'Ya existe un tratamiento con ese nombre.',
    )
  })

  it('returns no error for a new treatment name', () => {
    expect(validateTreatmentName(treatments, 'Ortodoncia')).toBe('')
  })

  it('filters treatments by search ignoring accents and case', () => {
    expect(
      filterTreatmentsBySearch(treatments, 'evaluacion').map(
        (treatment) => treatment.name,
      ),
    ).toEqual(['Evaluación inicial'])
  })
})
