import type { PatientId } from './Patient'

export type ToothStatus =
  | 'healthy'
  | 'caries'
  | 'restored'
  | 'missing'
  | 'pending'
  | 'observation'
  | 'other'

export type ToothCode =
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18'
  | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28'
  | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38'
  | '41' | '42' | '43' | '44' | '45' | '46' | '47' | '48'

export type ToothSurface =
  | 'distal'
  | 'lingual'
  | 'mesial'
  | 'occlusal'
  | 'palatal'
  | 'vestibular'

export interface OdontogramEntry {
  id: number | string
  patientId: PatientId
  toothCode: ToothCode
  surface: ToothSurface | null
  status: ToothStatus
  notes: string
  updatedAt: string
}

export interface SaveOdontogramEntryInput {
  clinicId: string
  notes: string
  patientId: PatientId
  status: ToothStatus
  surface: ToothSurface | null
  toothCode: ToothCode
}

export interface OdontogramFormValues {
  status: ToothStatus | ''
  notes: string
}

export type OdontogramFormErrors = Partial<
  Record<keyof OdontogramFormValues, string>
>

export interface OdontogramSaveResult {
  error?: string
  success: boolean
}
