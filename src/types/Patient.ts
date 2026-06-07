export interface Patient {
  id: number
  fullName: string
  phone: string
  lastVisit: string
  nextAppointment: string | null
  status: 'active' | 'follow-up' | 'inactive'
}
