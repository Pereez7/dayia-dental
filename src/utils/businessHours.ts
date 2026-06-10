import type {
  AppointmentInterval,
  BusinessDaySchedule,
  BusinessHoursErrors,
  BusinessHoursSettings,
  Weekday,
} from '../types/BusinessHours'

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
