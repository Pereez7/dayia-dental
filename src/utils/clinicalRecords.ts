import type {
  ClinicalRecord,
  ClinicalRecordFormErrors,
  ClinicalRecordFormValues,
} from '../types/ClinicalRecord'
import type { Patient, PatientId } from '../types/Patient'
import { formatCompactDateWithYear } from './dateFormatters'
import {
  compactText,
  normalizeSearchText,
  normalizeSentenceText,
} from './textNormalizers'

export type ClinicalHistoryPeriodFilter = 'all' | 'this-month' | 'last-30-days'

export interface GlobalClinicalRecord {
  id: number | string
  patientId: PatientId
  patientName: string
  patientPhone: string
  date: string
  reason: string
  diagnosis: string
  treatment: string
  notes: string
  hasPatient: boolean
}

export interface ClinicalRecordPatientGroup {
  patientId: PatientId
  patientName: string
  patientPhone: string
  hasPatient: boolean
  totalRecords: number
  latestRecord: GlobalClinicalRecord
  records: GlobalClinicalRecord[]
  matchingRecords: GlobalClinicalRecord[]
}

export function sortClinicalRecordsByDateDesc(records: ClinicalRecord[]) {
  return [...records].sort(
    (firstRecord, secondRecord) =>
      getDateTime(secondRecord.date) - getDateTime(firstRecord.date),
  )
}

export function getClinicalRecordsByPatient(
  records: ClinicalRecord[],
  patientId: PatientId,
) {
  return sortClinicalRecordsByDateDesc(
    records.filter((record) => record.patientId === patientId),
  )
}

export function getGlobalClinicalRecords(
  records: ClinicalRecord[],
  patients: Patient[],
): GlobalClinicalRecord[] {
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]))

  return sortGlobalClinicalRecordsByDateDesc(
    records.map((record) => {
      const patient = patientsById.get(record.patientId)

      return {
        id: record.id,
        patientId: record.patientId,
        patientName: patient?.fullName ?? 'Paciente no encontrado',
        patientPhone: patient?.phone ?? '',
        date: record.date,
        reason: record.reason,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes,
        hasPatient: Boolean(patient),
      }
    }),
  )
}

export function sortGlobalClinicalRecordsByDateDesc(
  records: GlobalClinicalRecord[],
) {
  return [...records].sort(
    (firstRecord, secondRecord) =>
      getDateTime(secondRecord.date) - getDateTime(firstRecord.date),
  )
}

export function filterGlobalClinicalRecords(
  records: GlobalClinicalRecord[],
  searchText: string,
) {
  const normalizedSearchText = normalizeSearchText(searchText)

  if (!normalizedSearchText) {
    return records
  }

  return records.filter((record) =>
    normalizeSearchText(
      [
        record.patientName,
        record.reason,
        record.diagnosis,
        record.treatment,
        record.notes,
      ].join(' '),
    ).includes(normalizedSearchText),
  )
}

export function groupClinicalRecordsByPatient(
  records: GlobalClinicalRecord[],
): ClinicalRecordPatientGroup[] {
  const groupsByPatientId = new Map<PatientId, GlobalClinicalRecord[]>()

  records.forEach((record) => {
    const patientRecords = groupsByPatientId.get(record.patientId) ?? []
    patientRecords.push(record)
    groupsByPatientId.set(record.patientId, patientRecords)
  })

  return Array.from(groupsByPatientId.values())
    .map((patientRecords) => {
      const sortedRecords = sortGlobalClinicalRecordsByDateDesc(patientRecords)
      const latestRecord = getLatestClinicalRecord(sortedRecords)

      return {
        patientId: latestRecord.patientId,
        patientName: latestRecord.patientName,
        patientPhone: latestRecord.patientPhone,
        hasPatient: latestRecord.hasPatient,
        totalRecords: sortedRecords.length,
        latestRecord,
        records: sortedRecords,
        matchingRecords: sortedRecords,
      }
    })
    .sort(
      (firstGroup, secondGroup) =>
        getDateTime(secondGroup.latestRecord.date) -
        getDateTime(firstGroup.latestRecord.date),
    )
}

export function getLatestClinicalRecord(records: GlobalClinicalRecord[]) {
  return sortGlobalClinicalRecordsByDateDesc(records)[0]
}

export function filterClinicalRecordGroups(
  groups: ClinicalRecordPatientGroup[],
  searchText: string,
) {
  const normalizedSearchText = normalizeSearchText(searchText)

  if (!normalizedSearchText) {
    return groups
  }

  return groups.reduce<ClinicalRecordPatientGroup[]>((matchingGroups, group) => {
    const patientMatches = normalizeSearchText(
      [group.patientName, group.patientPhone].join(' '),
    ).includes(normalizedSearchText)
    const matchingRecords = group.records.filter((record) =>
      normalizeSearchText(
        [
          record.reason,
          record.diagnosis,
          record.treatment,
          record.notes,
        ].join(' '),
      ).includes(normalizedSearchText),
    )

    if (!patientMatches && matchingRecords.length === 0) {
      return matchingGroups
    }

    matchingGroups.push({
      ...group,
      matchingRecords: patientMatches ? group.records : matchingRecords,
    })

    return matchingGroups
  }, [])
}

export function filterGlobalClinicalRecordsByPeriod(
  records: GlobalClinicalRecord[],
  periodFilter: ClinicalHistoryPeriodFilter,
  referenceDate = new Date(),
) {
  if (periodFilter === 'all') {
    return records
  }

  return records.filter((record) => {
    const recordDate = parseDate(record.date)

    if (!recordDate) {
      return false
    }

    if (periodFilter === 'this-month') {
      return (
        recordDate.getFullYear() === referenceDate.getFullYear() &&
        recordDate.getMonth() === referenceDate.getMonth()
      )
    }

    const startDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - 30,
    )
    const endDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      23,
      59,
      59,
    )

    return recordDate >= startDate && recordDate <= endDate
  })
}

export function getClinicalHistorySummary(
  records: GlobalClinicalRecord[],
  referenceDate = new Date(),
) {
  return {
    totalRecords: records.length,
    recordsThisMonth: filterGlobalClinicalRecordsByPeriod(
      records,
      'this-month',
      referenceDate,
    ).length,
    patientsWithHistory: new Set(records.map((record) => record.patientId))
      .size,
  }
}

export function formatClinicalRecordDisplayText(value: string) {
  const compactValue = compactText(value)

  if (!compactValue) {
    return ''
  }

  const normalizedText = compactValue.replace(
    /\b(aplicacion|curacion|diagnostico|evolucion|fluor|odontologico|clinico)\b/gi,
    (match) => {
      const replacement = clinicalDisplayReplacements[match.toLowerCase()]

      if (!replacement) {
        return match
      }

      return match.charAt(0) === match.charAt(0).toUpperCase()
        ? `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`
        : replacement
    },
  )

  return `${normalizedText.charAt(0).toUpperCase()}${normalizedText.slice(1)}`
}

export function normalizeClinicalRecordFormValues(
  values: ClinicalRecordFormValues,
): ClinicalRecordFormValues {
  return {
    date: values.date,
    reason: normalizeSentenceText(values.reason),
    diagnosis: normalizeSentenceText(values.diagnosis),
    treatment: normalizeSentenceText(values.treatment),
    notes: normalizeSentenceText(values.notes),
  }
}

export function getClinicalRecordsTimelineSummary(records: ClinicalRecord[]) {
  if (records.length === 0) {
    return ''
  }

  if (records.length === 1) {
    return '1 registro clínico'
  }

  const sortedRecords = sortClinicalRecordsByDateDesc(records)
  const firstRecord = sortedRecords[sortedRecords.length - 1]
  const lastRecord = sortedRecords[0]

  return `${records.length} registros · Desde ${formatCompactDateWithYear(
    firstRecord.date,
  )} hasta ${formatCompactDateWithYear(lastRecord.date)}`
}

export function validateClinicalRecordForm(
  values: ClinicalRecordFormValues,
  referenceDate = new Date(),
): ClinicalRecordFormErrors {
  const errors: ClinicalRecordFormErrors = {}

  if (!values.date) {
    errors.date = 'Selecciona una fecha.'
  } else if (isFutureDate(values.date, referenceDate)) {
    errors.date = 'La fecha no puede ser futura.'
  }

  if (!values.reason.trim()) {
    errors.reason = 'Ingresa el motivo de consulta.'
  }

  if (!values.diagnosis.trim()) {
    errors.diagnosis = 'Ingresa el diagnostico.'
  }

  if (!values.treatment.trim()) {
    errors.treatment = 'Ingresa el tratamiento.'
  }

  return errors
}

export function hasClinicalRecordFormErrors(
  errors: ClinicalRecordFormErrors,
) {
  return Object.values(errors).some(Boolean)
}

function isFutureDate(date: string, referenceDate: Date) {
  const selectedDate = new Date(`${date}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )

  return selectedDate.getTime() > today.getTime()
}

function getDateTime(date: string) {
  return parseDate(date)?.getTime() ?? Number.NEGATIVE_INFINITY
}

function parseDate(date: string) {
  const parsedDate = new Date(date.includes('T') ? date : `${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return parsedDate
}

const clinicalDisplayReplacements: Record<string, string> = {
  aplicacion: 'aplicación',
  curacion: 'curación',
  diagnostico: 'diagnóstico',
  evolucion: 'evolución',
  fluor: 'flúor',
  odontologico: 'odontológico',
  clinico: 'clínico',
}
