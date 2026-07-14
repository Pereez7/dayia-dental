import type {
  OdontogramEntry,
  OdontogramFormErrors,
  OdontogramFormValues,
  ToothCode,
  ToothStatus,
} from '../types/Odontogram'
import type { PatientId } from '../types/Patient'
import { normalizeSentenceText } from './textNormalizers'

export const toothStatuses: ToothStatus[] = [
  'healthy',
  'caries',
  'restored',
  'missing',
  'pending',
  'observation',
  'other',
]

export interface AdultTeethGroup {
  id: 'upper' | 'lower'
  label: string
  range: string
  quadrants: Array<{
    label: string
    range: string
    teeth: ToothCode[]
  }>
}

export const toothStatusLabels: Record<ToothStatus, string> = {
  caries: 'Caries',
  healthy: 'Sano',
  missing: 'Ausente',
  other: 'Otro',
  pending: 'Tratamiento pendiente',
  restored: 'Restaurado',
  observation: 'Observación',
}

export const toothStatusShortLabels: Record<ToothStatus, string> = {
  caries: 'Caries',
  healthy: 'Sano',
  missing: 'Ausente',
  other: 'Otro',
  pending: 'Pendiente',
  restored: 'Restaurado',
  observation: 'Observación',
}

export function generateAdultTeethNumbers() {
  return [
    '18', '17', '16', '15', '14', '13', '12', '11',
    '21', '22', '23', '24', '25', '26', '27', '28',
    '48', '47', '46', '45', '44', '43', '42', '41',
    '31', '32', '33', '34', '35', '36', '37', '38',
  ] satisfies ToothCode[]
}

export function generateAdultTeethGroups(): AdultTeethGroup[] {
  return [
    {
      id: 'upper',
      label: 'Arcada superior',
      range: 'Piezas 11-28',
      quadrants: [
        {
          label: 'Derecha del paciente',
          range: 'Piezas 18-11',
          teeth: ['18', '17', '16', '15', '14', '13', '12', '11'],
        },
        {
          label: 'Izquierda del paciente',
          range: 'Piezas 21-28',
          teeth: ['21', '22', '23', '24', '25', '26', '27', '28'],
        },
      ],
    },
    {
      id: 'lower',
      label: 'Arcada inferior',
      range: 'Piezas 31-48',
      quadrants: [
        {
          label: 'Derecha del paciente',
          range: 'Piezas 48-41',
          teeth: ['48', '47', '46', '45', '44', '43', '42', '41'],
        },
        {
          label: 'Izquierda del paciente',
          range: 'Piezas 31-38',
          teeth: ['31', '32', '33', '34', '35', '36', '37', '38'],
        },
      ],
    },
  ]
}

export function getOdontogramEntriesByPatient(
  entries: OdontogramEntry[],
  patientId: PatientId,
) {
  return entries.filter((entry) => entry.patientId === patientId)
}

export function getToothEntry(
  entries: OdontogramEntry[],
  toothCode: ToothCode,
) {
  return entries.find(
    (entry) => entry.toothCode === toothCode && entry.surface === null,
  )
}

export function getToothStatus(
  entries: OdontogramEntry[],
  toothCode: ToothCode,
): ToothStatus {
  return getToothEntry(entries, toothCode)?.status ?? 'healthy'
}

export function summarizeToothStatuses(entries: OdontogramEntry[]) {
  const summary: Record<ToothStatus, number> = {
    caries: 0,
    healthy: 0,
    missing: 0,
    other: 0,
    pending: 0,
    restored: 0,
    observation: 0,
  }

  for (const toothCode of generateAdultTeethNumbers()) {
    summary[getToothStatus(entries, toothCode)] += 1
  }

  return summary
}

export function validateOdontogramForm(
  values: OdontogramFormValues,
): OdontogramFormErrors {
  const errors: OdontogramFormErrors = {}

  if (!values.status) {
    errors.status = 'Selecciona un estado.'
  } else if (!toothStatuses.includes(values.status)) {
    errors.status = 'Selecciona un estado valido.'
  }

  return errors
}

export function hasOdontogramFormErrors(errors: OdontogramFormErrors) {
  return Object.values(errors).some(Boolean)
}

export function normalizeOdontogramNotes(notes: string) {
  return normalizeSentenceText(notes)
}

export function upsertOdontogramEntry(
  entries: OdontogramEntry[],
  entry: OdontogramEntry,
) {
  const existingEntry = entries.find(
    (currentEntry) =>
      currentEntry.patientId === entry.patientId &&
      currentEntry.toothCode === entry.toothCode &&
      currentEntry.surface === entry.surface,
  )

  if (!existingEntry) {
    return [entry, ...entries]
  }

  return entries.map((currentEntry) =>
    currentEntry.id === existingEntry.id
      ? { ...entry, id: existingEntry.id }
      : currentEntry,
  )
}
