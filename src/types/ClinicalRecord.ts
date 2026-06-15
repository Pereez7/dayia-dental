import type { PatientId } from './Patient'

export interface ClinicalRecord {
  id: number
  patientId: PatientId
  date: string
  reason: string
  diagnosis: string
  treatment: string
  notes: string
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
