export interface ClinicalRecord {
  id: number
  patientId: number
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
