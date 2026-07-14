import type { PatientId } from './Patient'

export interface ClinicalRecord {
  id: number | string
  patientId: PatientId
  date: string
  reason: string
  diagnosis: string
  treatment: string
  notes: string
}

export interface CreateClinicalRecordInput {
  clinicId: string
  patientId: PatientId
  recordDate: string
  reason: string
  diagnosis: string
  treatment: string
  observations: string
}

export interface ClinicalRecordFormValues {
  date: string
  reason: string
  diagnosis: string
  treatment: string
  notes: string
}

export type ClinicalRecordFormErrors = Partial<
  Record<keyof ClinicalRecordFormValues, string>
>
