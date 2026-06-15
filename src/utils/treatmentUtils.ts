import type { Treatment } from '../types/Treatment'

const treatmentNamePattern = /^[\p{L}\p{N}\s/()-]+$/u
export const allowedTreatmentDurations = [15, 30, 45, 60, 90, 120]
export const defaultTreatmentDurationMinutes = 30

export function compactTreatmentName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function formatTreatmentName(name: string) {
  const compactName = compactTreatmentName(name).toLocaleLowerCase('es-BO')

  if (!compactName) {
    return ''
  }

  return `${compactName.charAt(0).toLocaleUpperCase('es-BO')}${compactName.slice(
    1,
  )}`
}

export function normalizeTreatmentNameForComparison(name: string) {
  return compactTreatmentName(name)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-BO')
}

export function getActiveTreatments(treatments: Treatment[]) {
  return treatments.filter((treatment) => treatment.isActive)
}

export function isValidTreatmentDuration(durationMinutes: number) {
  return allowedTreatmentDurations.includes(durationMinutes)
}

export function getTreatmentDuration(
  treatments: Treatment[],
  treatmentName: string,
  fallbackDuration = defaultTreatmentDurationMinutes,
) {
  const treatment = treatments.find(
    (currentTreatment) => currentTreatment.name === treatmentName,
  )

  if (
    treatment &&
    Number.isFinite(treatment.durationMinutes) &&
    isValidTreatmentDuration(treatment.durationMinutes)
  ) {
    return treatment.durationMinutes
  }

  return fallbackDuration
}

export function hasTreatmentName(
  treatments: Treatment[],
  name: string,
  ignoredTreatmentId?: number,
) {
  const normalizedName = normalizeTreatmentNameForComparison(name)

  return treatments.some(
    (treatment) =>
      treatment.id !== ignoredTreatmentId &&
      normalizeTreatmentNameForComparison(treatment.name) === normalizedName,
  )
}

export function validateTreatmentName(
  treatments: Treatment[],
  name: string,
  ignoredTreatmentId?: number,
) {
  const compactName = compactTreatmentName(name)

  if (!compactName) {
    return 'Ingresa el nombre del tratamiento.'
  }

  if (compactName.length < 3) {
    return 'El tratamiento debe tener al menos 3 caracteres.'
  }

  if (compactName.length > 60) {
    return 'El tratamiento no puede superar 60 caracteres.'
  }

  if (!treatmentNamePattern.test(compactName)) {
    return 'Usa solo letras, numeros, espacios y signos como /, -, ( ).'
  }

  if (hasTreatmentName(treatments, compactName, ignoredTreatmentId)) {
    return 'Ya existe un tratamiento con ese nombre.'
  }

  return ''
}

export function validateTreatmentDuration(durationMinutes: number) {
  if (!Number.isFinite(durationMinutes)) {
    return 'Selecciona una duración.'
  }

  if (durationMinutes <= 0) {
    return 'La duración debe ser mayor a 0.'
  }

  if (!isValidTreatmentDuration(durationMinutes)) {
    return 'Selecciona una duración válida.'
  }

  return ''
}

export function filterTreatmentsBySearch(
  treatments: Treatment[],
  searchText: string,
) {
  const normalizedSearch = normalizeTreatmentNameForComparison(searchText)

  if (!normalizedSearch) {
    return treatments
  }

  return treatments.filter((treatment) =>
    normalizeTreatmentNameForComparison(treatment.name).includes(
      normalizedSearch,
    ),
  )
}
