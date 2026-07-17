export const DEFAULT_CLINIC_TIME_ZONE = 'America/La_Paz'

export type ReminderDisposition = 'cancelled' | 'expired' | 'processable'

interface ReminderAppointmentSnapshot {
  appointmentDate: string
  appointmentTime: string
  status: string
}

export function resolveReminderDisposition(
  appointment: ReminderAppointmentSnapshot,
  referenceDate = new Date(),
  timeZone = DEFAULT_CLINIC_TIME_ZONE,
): ReminderDisposition {
  if (
    appointment.status === 'cancelled' ||
    appointment.status === 'completed' ||
    appointment.status === 'no_show'
  ) {
    return 'cancelled'
  }

  const appointmentKey =
    `${appointment.appointmentDate}T${appointment.appointmentTime.slice(0, 5)}`

  return appointmentKey < getZonedDateTimeKey(referenceDate, timeZone)
    ? 'expired'
    : 'processable'
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
