import type {
  AppointmentInterval,
  BusinessDaySchedule,
  BusinessHoursErrors,
  BusinessHoursSettings,
  CalendarException,
  CalendarExceptionFormErrors,
  CalendarExceptionFormValues,
  CalendarExceptionReason,
  Weekday,
} from '../types/BusinessHours'
import {
  createAppointmentTimeSlots,
  type AppointmentTimeSlot,
} from './appointmentTimeSlots'

export const weekdayLabels: Record<Weekday, string> = {
  friday: 'Viernes',
  monday: 'Lunes',
  saturday: 'Sábado',
  sunday: 'Domingo',
  thursday: 'Jueves',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
}

export const appointmentIntervals: AppointmentInterval[] = [15, 30, 45, 60]

export const calendarExceptionReasonLabels: Record<
  Exclude<CalendarExceptionReason, ''>,
  string
> = {
  'doctor-travel': 'Viaje del doctor',
  holiday: 'Feriado',
  maintenance: 'Mantenimiento',
  other: 'Otro',
  'special-campaign': 'Campaña especial',
}

export function validateBusinessHours(
  settings: BusinessHoursSettings,
): BusinessHoursErrors {
  return settings.weeklySchedule.reduce<BusinessHoursErrors>(
    (errors, daySchedule) => {
      const error = validateBusinessDaySchedule(daySchedule)

      if (!error) {
        return errors
      }

      return {
        ...errors,
        [daySchedule.day]: error,
      }
    },
    {},
  )
}

export function validateBusinessDaySchedule(
  daySchedule: BusinessDaySchedule,
) {
  if (!daySchedule.isOpen) {
    return ''
  }

  if (!daySchedule.startTime || !daySchedule.endTime) {
    return 'Define una hora de inicio y fin para este día.'
  }

  if (
    !isValidBusinessTimeFormat(daySchedule.startTime) ||
    !isValidBusinessTimeFormat(daySchedule.endTime)
  ) {
    return 'Usa formato de 24 horas HH:mm, por ejemplo 08:00.'
  }

  if (!isEndTimeAfterStartTime(daySchedule.startTime, daySchedule.endTime)) {
    return 'La hora de fin debe ser mayor que la hora de inicio.'
  }

  return ''
}

export function hasBusinessHoursErrors(errors: BusinessHoursErrors) {
  return Object.values(errors).some(Boolean)
}

export function areBusinessHoursSettingsEqual(
  firstSettings: BusinessHoursSettings,
  secondSettings: BusinessHoursSettings,
) {
  if (firstSettings.appointmentInterval !== secondSettings.appointmentInterval) {
    return false
  }

  if (
    firstSettings.weeklySchedule.length !== secondSettings.weeklySchedule.length
  ) {
    return false
  }

  return firstSettings.weeklySchedule.every((firstDaySchedule, index) => {
    const secondDaySchedule = secondSettings.weeklySchedule[index]

    return (
      firstDaySchedule.day === secondDaySchedule?.day &&
      firstDaySchedule.endTime === secondDaySchedule.endTime &&
      firstDaySchedule.isOpen === secondDaySchedule.isOpen &&
      firstDaySchedule.startTime === secondDaySchedule.startTime
    )
  })
}

export function getWeekdayFromDate(date: string): Weekday | null {
  if (!date) {
    return null
  }

  const parsedDate = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const weekdays: Weekday[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  return weekdays[parsedDate.getDay()]
}

export function getBusinessDayScheduleForDate(
  settings: BusinessHoursSettings,
  date: string,
) {
  const weekday = getWeekdayFromDate(date)

  if (!weekday) {
    return undefined
  }

  return settings.weeklySchedule.find((schedule) => schedule.day === weekday)
}

export function getCalendarExceptionForDate(
  exceptions: CalendarException[],
  date: string,
) {
  if (!date) {
    return undefined
  }

  return exceptions.find((exception) => exception.date === date)
}

export function getEffectiveBusinessHoursForDate(
  settings: BusinessHoursSettings,
  date: string,
  exceptions: CalendarException[] = [],
) {
  const weekday = getWeekdayFromDate(date)

  if (!weekday) {
    return undefined
  }

  const calendarException = getCalendarExceptionForDate(exceptions, date)

  if (calendarException?.type === 'closed') {
    return {
      day: weekday,
      endTime: '',
      isOpen: false,
      startTime: '',
    }
  }

  if (calendarException?.type === 'special-hours') {
    return {
      day: weekday,
      endTime: calendarException.endTime ?? '',
      isOpen: true,
      startTime: calendarException.startTime ?? '',
    }
  }

  return settings.weeklySchedule.find((schedule) => schedule.day === weekday)
}

export function generateBusinessTimeSlotsForDate(
  settings: BusinessHoursSettings,
  date: string,
  exceptions: CalendarException[] = [],
): AppointmentTimeSlot[] {
  const daySchedule = getEffectiveBusinessHoursForDate(
    settings,
    date,
    exceptions,
  )

  if (!daySchedule?.isOpen || validateBusinessDaySchedule(daySchedule)) {
    return []
  }

  return createAppointmentTimeSlots(
    daySchedule.startTime,
    daySchedule.endTime,
    settings.appointmentInterval,
  )
}

export function validateAppointmentAgainstBusinessHours(
  settings: BusinessHoursSettings,
  date: string,
  time: string,
  exceptions: CalendarException[] = [],
) {
  const calendarException = getCalendarExceptionForDate(exceptions, date)
  const daySchedule = getEffectiveBusinessHoursForDate(
    settings,
    date,
    exceptions,
  )

  if (!daySchedule) {
    return ''
  }

  if (!daySchedule.isOpen) {
    if (calendarException?.type === 'closed') {
      return 'El consultorio está cerrado por excepción ese día.'
    }

    return 'El consultorio está cerrado ese día.'
  }

  if (!time) {
    return ''
  }

  if (
    !isValidBusinessTimeFormat(time) ||
    !isTimeInsideBusinessHours(daySchedule, time)
  ) {
    return 'La hora seleccionada está fuera del horario de atención.'
  }

  const validSlots = generateBusinessTimeSlotsForDate(settings, date, exceptions)

  if (!validSlots.some((slot) => slot.value === time)) {
    return 'Selecciona una hora valida.'
  }

  return ''
}

export function validateCalendarExceptionForm(
  values: CalendarExceptionFormValues,
  exceptions: CalendarException[],
) {
  const errors: CalendarExceptionFormErrors = {}

  if (!values.date) {
    errors.date = 'Selecciona una fecha.'
  } else if (Number.isNaN(new Date(`${values.date}T00:00:00`).getTime())) {
    errors.date = 'Selecciona una fecha válida.'
  } else if (
    exceptions.some((calendarException) => calendarException.date === values.date)
  ) {
    errors.date = 'Ya existe una excepción para esa fecha.'
  }

  if (values.type === 'special-hours') {
    if (!values.startTime || !values.endTime) {
      errors.startTime = 'Define hora de inicio y fin.'
    } else if (
      !isValidBusinessTimeFormat(values.startTime) ||
      !isValidBusinessTimeFormat(values.endTime)
    ) {
      errors.startTime = 'Usa formato de 24 horas HH:mm.'
    } else if (!isEndTimeAfterStartTime(values.startTime, values.endTime)) {
      errors.endTime = 'La hora de fin debe ser mayor que la hora de inicio.'
    }
  }

  if (values.reason === 'other' && values.reasonDetail.trim().length > 80) {
    errors.reasonDetail = 'Usa un detalle de 80 caracteres o menos.'
  }

  return errors
}

export function hasCalendarExceptionFormErrors(
  errors: CalendarExceptionFormErrors,
) {
  return Object.values(errors).some(Boolean)
}

export function isTimeInsideBusinessHours(
  daySchedule: BusinessDaySchedule,
  time: string,
) {
  if (!daySchedule.isOpen || !isValidBusinessTimeFormat(time)) {
    return false
  }

  const timeMinutes = getTimeAsMinutes(time)

  return (
    timeMinutes >= getTimeAsMinutes(daySchedule.startTime) &&
    timeMinutes < getTimeAsMinutes(daySchedule.endTime)
  )
}

export function isEndTimeAfterStartTime(startTime: string, endTime: string) {
  return getTimeAsMinutes(endTime) > getTimeAsMinutes(startTime)
}

export function isValidBusinessTimeFormat(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

function getTimeAsMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':')

  return Number(hours) * 60 + Number(minutes)
}
