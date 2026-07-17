import type { Appointment } from '../types/Appointment'
import type { AppointmentStatus } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type {
  Reminder,
  ReminderAppointmentGroup,
  ReminderDateGroup,
  ReminderDateOption,
  ReminderStatus,
  ReminderStatusFilter,
  ReminderSummary,
  ReminderType,
} from '../types/Reminder'

type ScheduledReminderType = Exclude<ReminderType, 'immediate'>
type ReminderAppointmentStatus = Extract<
  AppointmentStatus,
  'confirmed' | 'pending' | 'rescheduled'
>

const reminderHoursBeforeAppointment: Record<ScheduledReminderType, number> = {
  '24h': 24,
  '2h': 2,
}

const late24HourReminderNote =
  'Recordatorio de 24h omitido por registro con poca anticipación.'
const nearAppointmentReminderNote =
  'Recordatorios de 24h y 2h omitidos por cita cercana.'

const initialReminderSummary: ReminderSummary = {
  cancelled: 0,
  failed: 0,
  pending: 0,
  scheduled: 0,
  sent: 0,
  skipped: 0,
}

const noPhoneReminderLabel = 'Sin teléfono registrado'

const activeReminderAppointmentStatuses: ReminderAppointmentStatus[] = [
  'pending',
  'confirmed',
  'rescheduled',
]

export function generateAppointmentReminders(
  appointments: Appointment[],
  patients: Patient[],
  referenceDate = new Date(),
) {
  return appointments
    .filter(
      (appointment) =>
        isActiveReminderAppointmentStatus(appointment.status) &&
        isFutureAppointmentDateTime(appointment, referenceDate),
    )
    .flatMap((appointment) => {
      const patient = findAppointmentPatient(appointment, patients)

      return generateRemindersForAppointment(appointment, patient, referenceDate)
    })
    .sort(compareRemindersByPriority)
}

export function generateRemindersForAppointment(
  appointment: Appointment,
  patient: Patient | undefined,
  referenceDate = new Date(),
) {
  if (
    !isActiveReminderAppointmentStatus(appointment.status) ||
    !isFutureAppointmentDateTime(appointment, referenceDate)
  ) {
    return []
  }

  return createAppointmentReminders(appointment, patient, referenceDate)
}

export function summarizeRemindersByStatus(reminders: Reminder[]) {
  return reminders.reduce<ReminderSummary>(
    (summary, reminder) => ({
      ...summary,
      [reminder.status]: summary[reminder.status] + 1,
    }),
    { ...initialReminderSummary },
  )
}

export function filterRemindersByStatus(
  reminders: Reminder[],
  statusFilter: ReminderStatusFilter,
) {
  if (statusFilter === 'all') {
    return reminders
  }

  return reminders.filter((reminder) => reminder.status === statusFilter)
}

export function filterRemindersByAppointmentDate(
  reminders: Reminder[],
  appointmentDate: string | null,
) {
  if (!appointmentDate) {
    return reminders
  }

  return reminders.filter(
    (reminder) => reminder.appointmentDate === appointmentDate,
  )
}

export function getReminderDateOptions(
  reminders: Reminder[],
  referenceDate = new Date(),
): ReminderDateOption[] {
  const appointmentDates = Array.from(
    new Set(reminders.map((reminder) => reminder.appointmentDate)),
  ).sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))

  return appointmentDates.map((appointmentDate) => ({
    appointmentDate,
    dateLabel: formatCompactReminderDate(appointmentDate),
    fullLabel: getReminderDateGroupLabel(appointmentDate, referenceDate),
    weekdayLabel: getReminderWeekdayLabel(appointmentDate, referenceDate),
  }))
}

export function groupRemindersByAppointmentDate(
  reminders: Reminder[],
  referenceDate = new Date(),
): ReminderDateGroup[] {
  const appointmentGroups = groupRemindersByAppointment(reminders)
  const dateGroups = new Map<string, ReminderAppointmentGroup[]>()

  for (const appointmentGroup of appointmentGroups) {
    const groups = dateGroups.get(appointmentGroup.appointmentDate) ?? []
    groups.push(appointmentGroup)
    dateGroups.set(appointmentGroup.appointmentDate, groups)
  }

  return Array.from(dateGroups, ([appointmentDate, groups]) => ({
    appointmentDate,
    appointmentGroups: groups,
    label: getReminderDateGroupLabel(appointmentDate, referenceDate),
  })).sort((firstGroup, secondGroup) =>
    firstGroup.appointmentDate.localeCompare(secondGroup.appointmentDate),
  )
}

export function groupRemindersByAppointment(reminders: Reminder[]) {
  const appointmentGroups = new Map<string, ReminderAppointmentGroup>()

  for (const reminder of sortRemindersByAppointment(reminders)) {
    const appointmentOccurrenceKey = [
      reminder.appointmentId,
      reminder.appointmentDate,
      reminder.appointmentTime,
    ].join(':')
    const currentGroup = appointmentGroups.get(appointmentOccurrenceKey)

    if (currentGroup) {
      currentGroup.reminders.push(reminder)
      continue
    }

    appointmentGroups.set(appointmentOccurrenceKey, {
      appointmentDate: reminder.appointmentDate,
      appointmentId: reminder.appointmentId,
      appointmentStatus: reminder.appointmentStatus,
      appointmentTime: reminder.appointmentTime,
      patientId: reminder.patientId,
      patientName: reminder.patientName,
      phone: reminder.phone,
      rescheduleReason: reminder.rescheduleReason,
      rescheduleReasonDetail: reminder.rescheduleReasonDetail,
      omittedReminderNotes: reminder.omittedReminderNotes ?? [],
      reminders: [reminder],
      treatment: reminder.treatment,
    })
  }

  return Array.from(appointmentGroups.values())
}

export function updateReminderStatus(
  reminders: Reminder[],
  reminderId: string,
  status: ReminderStatus,
) {
  return reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, status } : reminder,
  )
}

export function canMarkReminderAsSent(reminder: Reminder | undefined) {
  return Boolean(reminder && hasReminderPhone(reminder.phone))
}

export function getReminderTypeLabel(reminderType: ReminderType) {
  const labels: Record<ReminderType, string> = {
    '24h': '24 horas antes',
    '2h': '2 horas antes',
    immediate: 'Confirmación inmediata',
  }

  return labels[reminderType]
}

export function getReminderStatusLabel(status: ReminderStatus) {
  const labels: Record<ReminderStatus, string> = {
    cancelled: 'Cancelado',
    failed: 'Fallido',
    pending: 'Pendiente',
    scheduled: 'Programado',
    sent: 'Enviado',
    skipped: 'Omitido',
  }

  return labels[status]
}

export function getReminderStatusClassName(status: ReminderStatus) {
  return `reminder-status--${status}`
}

export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
}

export function buildWhatsAppReminderUrl(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone)

  if (!normalizedPhone || phone.trim() === noPhoneReminderLabel) {
    return ''
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export function getScheduledFor(
  appointmentDate: string,
  appointmentTime: string,
  reminderType: ScheduledReminderType,
) {
  const scheduledDate = getAppointmentDateTime(appointmentDate, appointmentTime)
  scheduledDate.setHours(
    scheduledDate.getHours() - reminderHoursBeforeAppointment[reminderType],
  )

  return formatDateTimeValue(scheduledDate)
}

export function formatReminderScheduledDateTime(value: string) {
  const date = new Date(value)
  const dateLabel = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace('.', '')
    .replace('-', ' ')
  const timeLabel = new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).format(date)

  return `${dateLabel}, ${timeLabel}`.replace(/\s+/g, ' ')
}

export function createWhatsAppReminderMessage(
  patientName: string,
  treatment: string,
  appointmentDate: string,
  appointmentTime: string,
  reminderType: ReminderType = '24h',
  referenceDate = new Date(),
  appointmentStatus: ReminderAppointmentStatus = 'pending',
) {
  const firstName = patientName.trim().split(/\s+/)[0] || patientName
  const formattedDate = formatReminderMessageDate(
    appointmentDate,
    referenceDate,
  )

  if (appointmentStatus === 'confirmed') {
    return `Hola ${firstName}, te recordamos tu cita odontológica confirmada para ${treatment} ${formattedDate} a las ${appointmentTime}.`
  }

  if (appointmentStatus === 'rescheduled') {
    return `Hola ${firstName}, te recordamos que tu cita fue reprogramada para ${treatment} ${formattedDate} a las ${appointmentTime}. Por favor confirma tu asistencia.`
  }

  if (reminderType === 'immediate') {
    return `Hola ${firstName}, te recordamos que tienes una cita odontológica para ${treatment} ${formattedDate} a las ${appointmentTime}. Por favor confirma tu asistencia.`
  }

  return `Hola ${firstName}, te recordamos tu cita odontológica para ${treatment} ${formattedDate} a las ${appointmentTime}. Por favor confirma tu asistencia.`
}

export function isActiveReminderAppointmentStatus(
  status: AppointmentStatus,
): status is ReminderAppointmentStatus {
  return activeReminderAppointmentStatuses.includes(
    status as ReminderAppointmentStatus,
  )
}

export function getReminderDateGroupLabel(
  appointmentDate: string,
  referenceDate = new Date(),
) {
  const targetDate = new Date(`${appointmentDate}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const formattedDate = formatNaturalReminderDate(appointmentDate)

  if (targetDate.getTime() === today.getTime()) {
    return `Hoy, ${formattedDate}`
  }

  if (targetDate.getTime() === tomorrow.getTime()) {
    return `Mañana, ${formattedDate}`
  }

  const weekday = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
  }).format(targetDate)

  return `${capitalizeFirstLetter(weekday)}, ${formattedDate}`
}

function formatCompactReminderDate(appointmentDate: string) {
  const dateParts = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
  })
    .formatToParts(new Date(`${appointmentDate}T00:00:00`))
  const day = dateParts.find((part) => part.type === 'day')?.value ?? ''
  const month = dateParts.find((part) => part.type === 'month')?.value ?? ''

  return `${day} ${month.replace('.', '')}`.trim()
}

function formatNaturalReminderDate(appointmentDate: string) {
  const dateParts = new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
  })
    .formatToParts(new Date(`${appointmentDate}T00:00:00`))
  const day = dateParts.find((part) => part.type === 'day')?.value ?? ''
  const month = dateParts.find((part) => part.type === 'month')?.value ?? ''

  return `${day} de ${month}`.trim()
}

function getReminderWeekdayLabel(
  appointmentDate: string,
  referenceDate: Date,
) {
  const targetDate = new Date(`${appointmentDate}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (targetDate.getTime() === today.getTime()) {
    return 'Hoy'
  }

  if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Mañana'
  }

  const weekday = new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
  })
    .format(targetDate)
    .replace('.', '')

  return capitalizeFirstLetter(weekday)
}

function capitalizeFirstLetter(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function createAppointmentReminders(
  appointment: Appointment,
  patient: Patient | undefined,
  referenceDate: Date,
) {
  const scheduledReminders = createReminderTypes()
    .map((reminderType) => ({
      reminderType,
      scheduledFor: getScheduledFor(
        appointment.date,
        appointment.time,
        reminderType,
      ),
    }))
    .filter(({ scheduledFor }) => new Date(scheduledFor) > referenceDate)

  if (scheduledReminders.length > 0) {
    const omittedReminderNotes = getOmittedReminderNotes(
      scheduledReminders.map(({ reminderType }) => reminderType),
    )

    return scheduledReminders.map(({ reminderType, scheduledFor }) =>
      createReminder(
        appointment,
        patient,
        reminderType,
        scheduledFor,
        referenceDate,
        omittedReminderNotes,
      ),
    )
  }

  return [
    createReminder(
      appointment,
      patient,
      'immediate',
      formatDateTimeValue(referenceDate),
      referenceDate,
      [nearAppointmentReminderNote],
    ),
  ]
}

function getOmittedReminderNotes(
  generatedReminderTypes: ScheduledReminderType[],
) {
  const has24HourReminder = generatedReminderTypes.includes('24h')

  return has24HourReminder ? [] : [late24HourReminderNote]
}

function createReminder(
  appointment: Appointment,
  patient: Patient | undefined,
  reminderType: ReminderType,
  scheduledFor: string,
  referenceDate: Date,
  omittedReminderNotes: string[],
): Reminder {
  const patientName = appointment.patient.trim() || 'Paciente sin nombre'
  const appointmentStatus = isActiveReminderAppointmentStatus(appointment.status)
    ? appointment.status
    : 'pending'
  const phone = patient?.phone ?? noPhoneReminderLabel

  return {
    appointmentDate: appointment.date,
    appointmentId: appointment.id,
    appointmentStatus,
    appointmentTime: appointment.time,
    id: `${appointment.id}-${reminderType}`,
    message: createWhatsAppReminderMessage(
      patientName,
      appointment.treatment,
      appointment.date,
      appointment.time,
      reminderType,
      referenceDate,
      appointmentStatus,
    ),
    omittedReminderNotes,
    patientId: patient?.id ?? appointment.patientId ?? null,
    patientName,
    phone,
    rescheduleReason: appointment.rescheduleReason,
    rescheduleReasonDetail: appointment.rescheduleReasonDetail,
    reminderType,
    scheduledFor,
    status: hasReminderPhone(phone)
      ? reminderType === '24h'
        ? 'scheduled'
        : 'pending'
      : 'skipped',
    treatment: appointment.treatment,
  }
}

function createReminderTypes(): ScheduledReminderType[] {
  return ['24h', '2h']
}

function sortRemindersByAppointment(reminders: Reminder[]) {
  return [...reminders].sort((firstReminder, secondReminder) => {
    const firstDateTime = `${firstReminder.appointmentDate}T${firstReminder.appointmentTime}`
    const secondDateTime = `${secondReminder.appointmentDate}T${secondReminder.appointmentTime}`

    if (firstDateTime === secondDateTime) {
      return firstReminder.reminderType.localeCompare(secondReminder.reminderType)
    }

    return firstDateTime.localeCompare(secondDateTime)
  })
}

function compareRemindersByPriority(
  firstReminder: Reminder,
  secondReminder: Reminder,
) {
  const firstPriority = getReminderPriority(firstReminder)
  const secondPriority = getReminderPriority(secondReminder)

  if (firstPriority !== secondPriority) {
    return firstPriority - secondPriority
  }

  const firstScheduledFor = new Date(firstReminder.scheduledFor).getTime()
  const secondScheduledFor = new Date(secondReminder.scheduledFor).getTime()

  if (firstScheduledFor !== secondScheduledFor) {
    return firstScheduledFor - secondScheduledFor
  }

  const firstDateTime = `${firstReminder.appointmentDate}T${firstReminder.appointmentTime}`
  const secondDateTime = `${secondReminder.appointmentDate}T${secondReminder.appointmentTime}`

  return firstDateTime.localeCompare(secondDateTime)
}

function getReminderPriority(reminder: Reminder) {
  if (
    reminder.appointmentStatus === 'pending' &&
    reminder.status === 'pending'
  ) {
    return 0
  }

  if (reminder.appointmentStatus === 'pending') {
    return 1
  }

  if (reminder.appointmentStatus === 'confirmed') {
    return 2
  }

  return 3
}

function hasReminderPhone(phone: string) {
  return phone.trim() !== noPhoneReminderLabel
}

function findAppointmentPatient(
  appointment: Appointment,
  patients: Patient[],
) {
  if (appointment.patientId) {
    return patients.find((patient) => patient.id === appointment.patientId)
  }

  return patients.find((patient) => patient.fullName === appointment.patient)
}

function isFutureAppointmentDateTime(
  appointment: Appointment,
  referenceDate: Date,
) {
  return getAppointmentDateTime(appointment.date, appointment.time) > referenceDate
}

function getAppointmentDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function formatDateTimeValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatReminderMessageDate(
  appointmentDate: string,
  referenceDate: Date,
) {
  const targetDate = new Date(`${appointmentDate}T00:00:00`)
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (targetDate.getTime() === today.getTime()) {
    return 'hoy'
  }

  if (targetDate.getTime() === tomorrow.getTime()) {
    return 'mañana'
  }

  return `el ${formatNaturalReminderDate(appointmentDate)}`
}
