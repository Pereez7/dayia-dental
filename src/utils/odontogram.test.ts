import { describe, expect, it } from 'vitest'
import type { OdontogramEntry, ToothStatus } from '../types/Odontogram'
import {
  generateAdultTeethGroups,
  generateAdultTeethNumbers,
  getOdontogramEntriesByPatient,
  getToothStatus,
  normalizeOdontogramNotes,
  summarizeToothStatuses,
  toothStatusLabels,
  toothStatusShortLabels,
  upsertOdontogramEntry,
  validateOdontogramForm,
} from './odontogram'

const entries: OdontogramEntry[] = [
  {
    id: 1,
    patientId: 1,
    toothNumber: 16,
    status: 'caries',
    notes: 'Caries visible',
    updatedAt: '2026-06-08',
  },
  {
    id: 2,
    patientId: 2,
    toothNumber: 26,
    status: 'restored',
    notes: 'Restaurado',
    updatedAt: '2026-06-08',
  },
]

describe('odontogram helpers', () => {
  it('generates adult permanent teeth using FDI numbering', () => {
    expect(generateAdultTeethNumbers()).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48,
    ])
  })

  it('groups adult permanent teeth by arch and quadrant', () => {
    expect(generateAdultTeethGroups()).toEqual([
      {
        id: 'upper',
        label: 'Arcada superior',
        range: 'Piezas 11-28',
        quadrants: [
          {
            label: 'Derecha del paciente',
            range: 'Piezas 11-18',
            teeth: [11, 12, 13, 14, 15, 16, 17, 18],
          },
          {
            label: 'Izquierda del paciente',
            range: 'Piezas 21-28',
            teeth: [21, 22, 23, 24, 25, 26, 27, 28],
          },
        ],
      },
      {
        id: 'lower',
        label: 'Arcada inferior',
        range: 'Piezas 31-48',
        quadrants: [
          {
            label: 'Izquierda del paciente',
            range: 'Piezas 31-38',
            teeth: [31, 32, 33, 34, 35, 36, 37, 38],
          },
          {
            label: 'Derecha del paciente',
            range: 'Piezas 41-48',
            teeth: [41, 42, 43, 44, 45, 46, 47, 48],
          },
        ],
      },
    ])
  })

  it('filters odontogram entries by patient', () => {
    expect(getOdontogramEntriesByPatient(entries, 1)).toEqual([entries[0]])
  })

  it('returns healthy when a tooth has no entry', () => {
    expect(getToothStatus(entries, 11)).toBe('healthy')
  })

  it('counts teeth by status including healthy defaults', () => {
    const summary = summarizeToothStatuses([entries[0]])

    expect(summary.caries).toBe(1)
    expect(summary.healthy).toBe(31)
  })

  it('creates a new odontogram entry when the tooth does not exist', () => {
    const newEntry: OdontogramEntry = {
      id: 3,
      patientId: 1,
      toothNumber: 11,
      status: 'pending',
      notes: '',
      updatedAt: '2026-06-09',
    }

    expect(upsertOdontogramEntry(entries, newEntry)).toEqual([
      newEntry,
      ...entries,
    ])
  })

  it('updates an existing odontogram entry for the same patient and tooth', () => {
    const updatedEntry: OdontogramEntry = {
      id: 99,
      patientId: 1,
      toothNumber: 16,
      status: 'restored',
      notes: 'Restaurado',
      updatedAt: '2026-06-09',
    }

    expect(upsertOdontogramEntry(entries, updatedEntry)[0]).toEqual({
      ...updatedEntry,
      id: 1,
    })
  })

  it('normalizes odontogram notes', () => {
    expect(normalizeOdontogramNotes('  controlar   lesión con ñ  ')).toBe(
      'Controlar lesión con ñ',
    )
  })

  it('keeps consistent status labels for observation and pending states', () => {
    expect(toothStatusLabels.watch).toBe('En observación')
    expect(toothStatusShortLabels.watch).toBe('En observación')
    expect(toothStatusLabels.pending).toBe('Tratamiento pendiente')
    expect(toothStatusShortLabels.pending).toBe('Pendiente')
  })
})

describe('validateOdontogramForm', () => {
  it('requires a status', () => {
    expect(validateOdontogramForm({ status: '', notes: '' }).status).toBe(
      'Selecciona un estado.',
    )
  })

  it('requires a valid status', () => {
    expect(
      validateOdontogramForm({
        status: 'invalid-status' as ToothStatus,
        notes: '',
      }).status,
    ).toBe('Selecciona un estado valido.')
  })

  it('returns no errors when status is valid', () => {
    expect(validateOdontogramForm({ status: 'healthy', notes: '' })).toEqual({})
  })
})
