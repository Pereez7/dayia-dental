export type TreatmentId = number | string

export interface Treatment {
  durationMinutes: number
  id: TreatmentId
  name: string
  isActive: boolean
}
