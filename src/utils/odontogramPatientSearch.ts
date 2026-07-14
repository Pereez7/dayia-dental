import type { Patient, PatientId } from '../types/Patient'
import { normalizeSearchText } from './textNormalizers'

export function filterOdontogramPatients(
  patients: Patient[],
  searchTerm: string,
) {
  const normalizedSearch = normalizeSearchText(searchTerm)

  if (!normalizedSearch) {
    return patients
  }

  return patients.filter((patient) =>
    normalizeSearchText(
      [patient.fullName, patient.phone, patient.email ?? ''].join(' '),
    ).includes(normalizedSearch),
  )
}

export function getOdontogramPatientSelection(patient: Patient) {
  return {
    patientId: patient.id,
    searchTerm: patient.fullName,
  }
}

export function findOdontogramPatientById(
  patients: Patient[],
  patientId: string,
) {
  return patients.find(({ id }) => String(id) === patientId)
}

export function syncOdontogramPatientSelection(
  patient: Patient,
  updateSearchTerm: (value: string) => void,
  onSelectPatient: (patientId: PatientId) => void,
) {
  const selection = getOdontogramPatientSelection(patient)
  updateSearchTerm(selection.searchTerm)
  onSelectPatient(selection.patientId)
}
