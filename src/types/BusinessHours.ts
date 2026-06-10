export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type AppointmentInterval = 15 | 30 | 45 | 60

export interface BusinessDaySchedule {
  day: Weekday
  endTime: string
  isOpen: boolean
  startTime: string
}

export interface BusinessHoursSettings {
  appointmentInterval: AppointmentInterval
  weeklySchedule: BusinessDaySchedule[]
}

export type BusinessHoursErrors = Partial<Record<Weekday, string>>
