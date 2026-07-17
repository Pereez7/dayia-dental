import type { Reminder } from '../types/Reminder'

export const DEFAULT_CLINIC_TIME_ZONE = 'America/La_Paz'
export const EXPIRED_REMINDER_METADATA_NOTE =
  'La cita ya pasó sin envío del recordatorio.'
export const EXPIRED_REMINDER_STATUS_NOTE =
  'Omitido porque la cita ya pasó.'

const mutableReminderStatuses = new Set(['pending', 'scheduled'])

export interface ReminderReconciliation {
  cancelledIds: string[]
  skippedIds: string[]
}

export function getReminderReconciliation(
  reminders: Reminder[],
  referenceDate = new Date(),
  timeZone = DEFAULT_CLINIC_TIME_ZONE,
): ReminderReconciliation {
  return reminders.reduce<ReminderReconciliation>(
    (result, reminder) => {
      if (!mutableReminderStatuses.has(reminder.status)) {
        return result
      }

      if (reminder.appointmentStatus === 'cancelled') {
        result.cancelledIds.push(reminder.id)
        return result
      }

      if (
        isAppointmentDateTimePast(
          reminder.appointmentDate,
          reminder.appointmentTime,
          referenceDate,
          timeZone,
        )
      ) {
        result.skippedIds.push(reminder.id)
      }

      return result
    },
    { cancelledIds: [], skippedIds: [] },
  )
}

export function isAppointmentDateTimePast(
  appointmentDate: string,
  appointmentTime: string,
  referenceDate = new Date(),
  timeZone = DEFAULT_CLINIC_TIME_ZONE,
) {
  const appointmentKey = `${appointmentDate}T${appointmentTime.slice(0, 5)}`
  return appointmentKey < getZonedDateTimeKey(referenceDate, timeZone)
}

export function getZonedDateTimeKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = new Map(parts.map((part) => [part.type, part.value]))

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}T${values.get('hour')}:${values.get('minute')}`
}
