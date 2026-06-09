import { describe, expect, it } from 'vitest'
import type { ClinicalRecordFormValues } from '../types/ClinicalRecord'
import {
  getClinicalRecordsByPatient,
  getClinicalRecordsTimelineSummary,
  hasClinicalRecordFormErrors,
  normalizeClinicalRecordFormValues,
  sortClinicalRecordsByDateDesc,
  validateClinicalRecordForm,
} from './clinicalRecords'

const records = [
  {
    id: 1,
    patientId: 1,
    date: '2026-05-18',
    reason: 'Control odontologico',
    diagnosis: 'Sin hallazgos relevantes',
    treatment: 'Profilaxis',
    notes: '',
  },
  {
    id: 2,
    patientId: 2,
    date: '2026-05-20',
    reason: 'Dolor dental',
    diagnosis: 'Caries',
    treatment: 'Curacion dental',
    notes: '',
  },
  {
    id: 3,
    patientId: 1,
    date: '2026-06-02',
    reason: 'Sensibilidad',
    diagnosis: 'Sensibilidad posterior',
    treatment: 'Aplicacion de fluor',
    notes: '',
  },
]

const validFormValues: ClinicalRecordFormValues = {
  date: '2026-06-08',
  reason: 'Consulta de control',
  diagnosis: 'Evolucion favorable',
  treatment: 'Control odontologico',
  notes: '',
}

describe('clinical record helpers', () => {
  it('filters records by patient and orders them from newest to oldest', () => {
    expect(getClinicalRecordsByPatient(records, 1)).toEqual([
      records[2],
      records[0],
    ])
  })

  it('sorts records by date descending', () => {
    expect(
      sortClinicalRecordsByDateDesc(records).map((record) => record.id),
    ).toEqual([3, 2, 1])
  })

  it('summarizes a single clinical record', () => {
    expect(getClinicalRecordsTimelineSummary([records[0]])).toBe(
      '1 registro clínico',
    )
  })

  it('summarizes the clinical record timeline range', () => {
    expect(getClinicalRecordsTimelineSummary(records)).toBe(
      '3 registros · Desde 18-may-2026 hasta 02-jun-2026',
    )
  })

  it('returns an empty summary when there are no clinical records', () => {
    expect(getClinicalRecordsTimelineSummary([])).toBe('')
  })

  it('normalizes clinical form text values', () => {
    expect(
      normalizeClinicalRecordFormValues({
        date: '2026-06-08',
        reason: '  dolor   de muela ',
        diagnosis: 'CARIES',
        treatment: ' limpieza   profunda ',
        notes: 'mantener   control con ñandú y té',
      }),
    ).toEqual({
      date: '2026-06-08',
      reason: 'Dolor de muela',
      diagnosis: 'Caries',
      treatment: 'Limpieza profunda',
      notes: 'Mantener control con ñandú y té',
    })
  })
})

describe('validateClinicalRecordForm', () => {
  it('returns no errors when values are valid', () => {
    expect(
      validateClinicalRecordForm(
        validFormValues,
        new Date('2026-06-08T10:00:00'),
      ),
    ).toEqual({})
  })

  it('requires mandatory fields', () => {
    const errors = validateClinicalRecordForm(
      {
        date: '',
        reason: '',
        diagnosis: '   ',
        treatment: '',
        notes: '',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.date).toBe('Selecciona una fecha.')
    expect(errors.reason).toBe('Ingresa el motivo de consulta.')
    expect(errors.diagnosis).toBe('Ingresa el diagnostico.')
    expect(errors.treatment).toBe('Ingresa el tratamiento.')
  })

  it('does not allow future dates', () => {
    const errors = validateClinicalRecordForm(
      {
        ...validFormValues,
        date: '2026-06-09',
      },
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.date).toBe('La fecha no puede ser futura.')
  })
})

describe('hasClinicalRecordFormErrors', () => {
  it('returns true when at least one error exists', () => {
    expect(hasClinicalRecordFormErrors({ reason: 'Ingresa el motivo.' })).toBe(
      true,
    )
  })

  it('returns false when there are no errors', () => {
    expect(hasClinicalRecordFormErrors({})).toBe(false)
  })
})
