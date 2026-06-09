import type {
  ClinicalRecord,
  ClinicalRecordFormErrors,
  ClinicalRecordFormValues,
} from '../types/ClinicalRecord'
import { formatCompactDateWithYear } from './dateFormatters'
import { normalizeSentenceText } from './textNormalizers'

export function sortClinicalRecordsByDateDesc(records: ClinicalRecord[]) {
  return [...records].sort((firstRecord, secondRecord) =>
    secondRecord.date.localeCompare(firstRecord.date),
  )
}

export function getClinicalRecordsByPatient(
  records: ClinicalRecord[],
  patientId: number,
) {
  return sortClinicalRecordsByDateDesc(
    records.filter((record) => record.patientId === patientId),
  )
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
