import { describe, expect, it } from 'vitest'
import type { ClinicalRecordFormValues } from '../types/ClinicalRecord'
import type { Patient } from '../types/Patient'
import {
  filterClinicalRecordGroups,
  filterGlobalClinicalRecords,
  formatClinicalRecordDisplayText,
  getLatestClinicalRecord,
  getClinicalHistorySummary,
  getClinicalRecordsByPatient,
  getClinicalRecordsTimelineSummary,
  getGlobalClinicalRecords,
  groupClinicalRecordsByPatient,
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

const patients: Patient[] = [
  {
    id: 1,
    fullName: 'Mariana Rojas',
    phone: '+59170012345',
    lastVisit: '2026-05-18',
    nextAppointment: null,
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Carlos Medina',
    phone: '+59171234567',
    lastVisit: '2026-05-20',
    nextAppointment: null,
    status: 'follow-up',
  },
  {
    id: 3,
    fullName: 'Ana Salazar',
    phone: '+59176543210',
    lastVisit: 'Sin registro',
    nextAppointment: null,
    status: 'inactive',
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

  it('gets global clinical records from all patients', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(globalRecords).toHaveLength(3)
    expect(globalRecords.map((record) => record.patientName)).toContain(
      'Mariana Rojas',
    )
    expect(globalRecords.map((record) => record.patientName)).toContain(
      'Carlos Medina',
    )
  })

  it('orders global clinical records from newest to oldest', () => {
    expect(
      getGlobalClinicalRecords(records, patients).map((record) => record.id),
    ).toEqual([3, 2, 1])
  })

  it('searches global records by patient name', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(
      filterGlobalClinicalRecords(globalRecords, '  mariana   rojas ').map(
        (record) => record.id,
      ),
    ).toEqual([3, 1])
  })

  it('searches global records by diagnosis', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(
      filterGlobalClinicalRecords(globalRecords, 'caries').map(
        (record) => record.id,
      ),
    ).toEqual([2])
  })

  it('searches global records by reason', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(
      filterGlobalClinicalRecords(globalRecords, 'dolor dental').map(
        (record) => record.id,
      ),
    ).toEqual([2])
  })

  it('searches global records by treatment', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(
      filterGlobalClinicalRecords(globalRecords, 'fluor').map(
        (record) => record.id,
      ),
    ).toEqual([3])
  })

  it('handles empty fields while searching global records', () => {
    const globalRecords = getGlobalClinicalRecords(
      [
        {
          id: 4,
          patientId: 1,
          date: '2026-06-09',
          reason: '',
          diagnosis: '',
          treatment: '',
          notes: '',
        },
      ],
      patients,
    )

    expect(filterGlobalClinicalRecords(globalRecords, 'mariana')).toHaveLength(
      1,
    )
    expect(filterGlobalClinicalRecords(globalRecords, 'endodoncia')).toEqual([])
  })

  it('counts clinical records from the current month', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(
      getClinicalHistorySummary(
        globalRecords,
        new Date('2026-06-14T10:00:00'),
      ),
    ).toEqual({
      totalRecords: 3,
      recordsThisMonth: 1,
      patientsWithHistory: 2,
    })
  })

  it('groups several records from the same patient into a single group', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(records, patients),
    )

    expect(groups).toHaveLength(2)
    expect(groups.find((group) => group.patientId === 1)?.records).toHaveLength(
      2,
    )
  })

  it('calculates the total clinical records per patient', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(records, patients),
    )

    expect(groups.find((group) => group.patientId === 1)?.totalRecords).toBe(2)
    expect(groups.find((group) => group.patientId === 2)?.totalRecords).toBe(1)
  })

  it('gets the latest clinical record correctly', () => {
    const globalRecords = getGlobalClinicalRecords(records, patients)

    expect(getLatestClinicalRecord(globalRecords).id).toBe(3)
  })

  it('searches grouped records by diagnosis and returns the matching patient', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(records, patients),
    )

    expect(
      filterClinicalRecordGroups(groups, 'sensibilidad posterior').map(
        (group) => group.patientName,
      ),
    ).toEqual(['Mariana Rojas'])
  })

  it('searches grouped records by treatment and returns the matching patient', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(records, patients),
    )

    expect(
      filterClinicalRecordGroups(groups, 'curacion dental').map(
        (group) => group.patientName,
      ),
    ).toEqual(['Carlos Medina'])
  })

  it('does not create groups for patients without clinical records', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(records, patients),
    )

    expect(groups.some((group) => group.patientId === 3)).toBe(false)
  })

  it('handles empty grouped record fields while searching', () => {
    const groups = groupClinicalRecordsByPatient(
      getGlobalClinicalRecords(
        [
          {
            id: 4,
            patientId: 1,
            date: '2026-06-09',
            reason: '',
            diagnosis: '',
            treatment: '',
            notes: '',
          },
        ],
        patients,
      ),
    )

    expect(filterClinicalRecordGroups(groups, 'mariana')).toHaveLength(1)
    expect(filterClinicalRecordGroups(groups, 'endodoncia')).toEqual([])
  })

  it('formats clinical text for display without changing the clinical meaning', () => {
    expect(formatClinicalRecordDisplayText('Aplicacion de fluor')).toBe(
      'Aplicación de flúor',
    )
    expect(formatClinicalRecordDisplayText('control odontologico')).toBe(
      'Control odontológico',
    )
  })

  it('returns an empty string when clinical display text is empty', () => {
    expect(formatClinicalRecordDisplayText('   ')).toBe('')
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
