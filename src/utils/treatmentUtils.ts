import type { Treatment } from '../types/Treatment'

const treatmentNamePattern = /^[\p{L}\p{N}\s/()-]+$/u

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
