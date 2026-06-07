export interface Patient {
  id: number
  fullName: string
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
  phone: string
  email: string
  birthDate: string
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues, string>>
