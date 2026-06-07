import type { Patient } from '../types/Patient'

export function filterPatients(patients: Patient[], searchText: string) {
  const normalizedSearch = searchText.trim().toLowerCase()

  if (normalizedSearch === '') {
    return patients
  }

  return patients.filter((patient) => {
    const searchableText = `${patient.fullName} ${patient.phone}`.toLowerCase()

    return searchableText.includes(normalizedSearch)
  })
}
