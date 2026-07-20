export type PatientId = number | string

export interface Patient {
  id: PatientId
  firstName?: string
  lastName?: string
  fullName: string
  countryCode?: string
  phone: string
  email?: string
  birthDate?: string
  lastVisit: string
  nextAppointment: string | null
  status: 'active' | 'follow-up' | 'inactive'
}

export interface PatientFormValues {
  firstName: string
  lastName: string
  countryCode: string
  localPhone: string
  email: string
  birthDate: string
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues, string>>
