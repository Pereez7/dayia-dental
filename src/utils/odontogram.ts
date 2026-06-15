import type {
  OdontogramEntry,
  OdontogramFormErrors,
  OdontogramFormValues,
  ToothStatus,
} from '../types/Odontogram'
import { normalizeSentenceText } from './textNormalizers'

export const toothStatuses: ToothStatus[] = [
  'healthy',
  'caries',
  'restored',
  'missing',
  'pending',
  'watch',
  'other',
]

export interface AdultTeethGroup {
  id: 'upper' | 'lower'
  label: string
  range: string
  quadrants: Array<{
    label: string
    range: string
    teeth: number[]
  }>
}

export const toothStatusLabels: Record<ToothStatus, string> = {
  caries: 'Caries',
  healthy: 'Sano',
  missing: 'Ausente',
  other: 'Otro',
  pending: 'Tratamiento pendiente',
  restored: 'Restaurado',
  watch: 'En observación',
}

export const toothStatusShortLabels: Record<ToothStatus, string> = {
  caries: 'Caries',
  healthy: 'Sano',
  missing: 'Ausente',
  other: 'Otro',
  pending: 'Pendiente',
  restored: 'Restaurado',
  watch: 'En observación',
}

export function generateAdultTeethNumbers() {
  return [1, 2, 3, 4].flatMap((quadrant) =>
    Array.from({ length: 8 }, (_, index) => quadrant * 10 + index + 1),
  )
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
  ]
}

export function getOdontogramEntriesByPatient(
  entries: OdontogramEntry[],
  patientId: number,
) {
  return entries.filter((entry) => entry.patientId === patientId)
}

export function getToothEntry(
  entries: OdontogramEntry[],
  toothNumber: number,
) {
  return entries.find((entry) => entry.toothNumber === toothNumber)
}

export function getToothStatus(
  entries: OdontogramEntry[],
  toothNumber: number,
): ToothStatus {
  return getToothEntry(entries, toothNumber)?.status ?? 'healthy'
}

export function summarizeToothStatuses(entries: OdontogramEntry[]) {
  const summary: Record<ToothStatus, number> = {
    caries: 0,
    healthy: 0,
    missing: 0,
    other: 0,
    pending: 0,
    restored: 0,
    watch: 0,
  }

  for (const toothNumber of generateAdultTeethNumbers()) {
    summary[getToothStatus(entries, toothNumber)] += 1
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
      currentEntry.toothNumber === entry.toothNumber,
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
