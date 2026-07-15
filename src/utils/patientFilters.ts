import type { Patient } from '../types/Patient'

export function filterPatients(patients: Patient[], searchText: string) {
  const normalizedSearch = normalizePatientSearchText(searchText)

  if (normalizedSearch === '') {
    return patients
  }

  return patients.filter((patient) => {
    const searchableText = normalizePatientSearchText(
      `${patient.fullName} ${patient.phone} ${patient.email ?? ''}`,
    )

    return searchableText.includes(normalizedSearch)
  })
}

export function normalizePatientSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
