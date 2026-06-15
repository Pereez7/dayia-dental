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

export type CalendarExceptionType = 'closed' | 'special-hours'

export type CalendarExceptionReason =
  | ''
  | 'holiday'
  | 'maintenance'
  | 'doctor-travel'
  | 'special-campaign'
  | 'other'

export interface CalendarException {
  id: number
  date: string
  type: CalendarExceptionType
  startTime?: string
  endTime?: string
  reason?: CalendarExceptionReason
  reasonDetail?: string
}

export interface CalendarExceptionFormValues {
  date: string
  endTime: string
  reason: CalendarExceptionReason
  reasonDetail: string
  startTime: string
  type: CalendarExceptionType
}

export type CalendarExceptionFormErrors = Partial<
  Record<keyof CalendarExceptionFormValues, string>
>
