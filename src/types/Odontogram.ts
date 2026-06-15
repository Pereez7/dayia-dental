import type { PatientId } from './Patient'

export type ToothStatus =
  | 'healthy'
  | 'caries'
  | 'restored'
  | 'missing'
  | 'pending'
  | 'watch'
  | 'other'

export interface OdontogramEntry {
  id: number
  patientId: PatientId
  toothNumber: number
  status: ToothStatus
  notes: string
  updatedAt: string
}

export interface OdontogramFormValues {
  status: ToothStatus | ''
  notes: string
}

export type OdontogramFormErrors = Partial<
  Record<keyof OdontogramFormValues, string>
>
