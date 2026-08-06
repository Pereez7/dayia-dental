import { supabase } from '../lib/supabaseClient'
import type { Appointment, AppointmentId } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type {
  ReminderRecord,
  ReminderRecordStatus,
  ReminderRecordType,
} from '../types/database'
import type {
  Reminder,
  ReminderQueueCursor,
  ReminderQueuePage,
  ReminderQueueSummary,
  ReminderStatus,
  ReminderStatusFilter,
} from '../types/Reminder'
import {
  generateRemindersForAppointment,
  getReminderDateOptionsFromDates,
} from '../utils/reminders'
import type { ReminderAppointmentStatusFilter } from '../utils/reminderView'
import {
  EXPIRED_REMINDER_METADATA_NOTE,
  EXPIRED_REMINDER_STATUS_NOTE,
  getReminderReconciliation,
} from '../utils/reminderExpiration'

export interface ReminderInput {
  appointmentId: string
  channel?: 'whatsapp'
  failedReason?: string | null
  message: string
  patientId: string
  reminderType: ReminderRecordType
  scheduledAt: string
  sentAt?: string | null
  status: ReminderStatus
}

type ReminderInsert = Omit<ReminderRecord, 'created_at' | 'id' | 'updated_at'>

export interface ReminderQueuePageOptions {
  appointmentStatus?: ReminderAppointmentStatusFilter
  cursor?: ReminderQueueCursor | null
  pageSize?: number
  referenceDate?: string
  referenceTime?: string
  search?: string
  selectedDate?: string | null
  status?: ReminderStatusFilter
}

type ReminderRpcClient = {
  rpc: (
    functionName:
      | 'get_clinic_reminder_queue_page'
      | 'reconcile_clinic_reminders',
    args: Record<string, boolean | number | string | null>,
  ) => PromiseLike<{
    data: unknown
    error: { message?: string } | null
  }>
}

export function mapReminderRecordToReminder(
  record: ReminderRecord,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
): Reminder {
  const appointment = appointments.find(
    (item) => item.id === record.appointment_id,
  )
  const appointmentSnapshot = getPersistedAppointmentSnapshot(record)
  const patient = patients.find((item) => item.id === record.patient_id)

  return {
    appointmentDate:
      appointmentSnapshot?.date ??
      appointment?.date ??
      getDateFromDateTime(record.scheduled_at),
    appointmentId: record.appointment_id,
    appointmentStatus:
      appointmentSnapshot?.status ?? appointment?.status ?? 'pending',
    appointmentTime:
      appointmentSnapshot?.time ??
      appointment?.time ??
      getTimeFromDateTime(record.scheduled_at),
    failedReason: record.failed_reason ?? undefined,
    id: record.id,
    message: record.message,
    patientId: record.patient_id,
    patientName: patient?.fullName ?? appointment?.patient ?? 'Paciente no encontrado',
    phone: patient?.phone ?? 'Sin teléfono registrado',
    reminderType: record.reminder_type,
    scheduledFor: record.scheduled_at,
    sentAt: record.sent_at ?? undefined,
    status: record.status as ReminderStatus,
    statusNote: getPersistedReminderStatusNote(record),
    treatment: appointment?.treatment ?? 'Tratamiento no registrado',
  }
}

export function mapReminderInputToInsert(
  clinicId: string,
  input: ReminderInput,
): ReminderInsert {
  return {
    appointment_id: input.appointmentId,
    channel: input.channel ?? 'whatsapp',
    clinic_id: clinicId,
    delivered_at: null,
    failed_reason: input.failedReason ?? null,
    message: input.message,
    metadata: {},
    patient_id: input.patientId,
    provider_message_id: null,
    read_at: null,
    reminder_type: input.reminderType,
    scheduled_at: input.scheduledAt,
    sent_at: input.sentAt ?? null,
    status: input.status as ReminderRecordStatus,
  }
}

export function mapReminderToInput(reminder: Reminder): ReminderInput | null {
  if (
    typeof reminder.appointmentId !== 'string' ||
    typeof reminder.patientId !== 'string'
  ) {
    return null
  }

  return {
    appointmentId: reminder.appointmentId,
    message: reminder.message,
    patientId: reminder.patientId,
    reminderType: reminder.reminderType,
    scheduledAt: reminder.scheduledFor,
    status: reminder.status,
  }
}

export async function getRemindersByClinic(
  clinicId: string,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('scheduled_at', { ascending: true })

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapReminderRecordToReminder(record as ReminderRecord, appointments, patients),
    ),
    error: null,
  }
}

export async function getReconciledRemindersByClinic(
  clinicId: string,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
  referenceDate = new Date(),
) {
  const initialResult = await getRemindersByClinic(
    clinicId,
    appointments,
    patients,
  )

  if (initialResult.error || !initialResult.data) {
    return initialResult
  }

  const reconciliationResult = await reconcileExpiredRemindersByClinic(
    clinicId,
    initialResult.data,
    referenceDate,
  )

  if (reconciliationResult.error) {
    return { data: null, error: reconciliationResult.error }
  }

  if (!reconciliationResult.data?.changed) {
    return initialResult
  }

  return getRemindersByClinic(clinicId, appointments, patients)
}

export async function reconcileExpiredRemindersByClinic(
  clinicId: string,
  reminders: Reminder[],
  referenceDate = new Date(),
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { cancelledIds, skippedIds } = getReminderReconciliation(
    reminders,
    referenceDate,
  )

  const skippedReminders = skippedIds
    .map((reminderId) =>
      reminders.find((reminder) => reminder.id === reminderId),
    )
    .filter((reminder): reminder is Reminder => reminder !== undefined)
  const updateResults = await Promise.all([
    updateReminderBatch(clinicId, cancelledIds, 'cancelled', {
      reason: 'appointment_cancelled',
    }),
    ...skippedReminders.map((reminder) =>
      updateReminderBatch(clinicId, [reminder.id], 'skipped', {
        appointment_date: reminder.appointmentDate,
        appointment_status: reminder.appointmentStatus,
        appointment_time: reminder.appointmentTime,
        note: EXPIRED_REMINDER_METADATA_NOTE,
        reason: 'appointment_passed',
      }),
    ),
  ])

  if (updateResults.some((result) => result.error)) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: {
      cancelledCount: cancelledIds.length,
      changed: cancelledIds.length > 0 || skippedIds.length > 0,
      skippedCount: skippedIds.length,
    },
    error: null,
  }
}

export async function getUpcomingRemindersByClinic(
  clinicId: string,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['pending', 'scheduled'] as never)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapReminderRecordToReminder(record as ReminderRecord, appointments, patients),
    ),
    error: null,
  }
}

export async function reconcileClinicReminders(
  clinicId: string,
  referenceAt = new Date().toISOString(),
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const rpcClient = supabase as unknown as ReminderRpcClient
  const { data, error } = await rpcClient.rpc('reconcile_clinic_reminders', {
    target_clinic_id: clinicId,
    target_reference_at: referenceAt,
  })

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage(error) }
  }

  const payload = asRecord(data)

  if (
    !payload ||
    typeof payload.cancelledCount !== 'number' ||
    typeof payload.changed !== 'boolean' ||
    typeof payload.skippedCount !== 'number'
  ) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: {
      cancelledCount: payload.cancelledCount,
      changed: payload.changed,
      skippedCount: payload.skippedCount,
    },
    error: null,
  }
}

export async function getReminderQueuePage(
  clinicId: string,
  options: ReminderQueuePageOptions = {},
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const referenceDate = options.referenceDate ?? getLocalDateInputValue()
  const rpcClient = supabase as unknown as ReminderRpcClient
  const { data, error } = await rpcClient.rpc(
    'get_clinic_reminder_queue_page',
    {
      target_after_group_id: options.cursor?.groupId ?? null,
      target_after_start_time: options.cursor?.startTime ?? null,
      target_appointment_status: options.appointmentStatus ?? 'all',
      target_clinic_id: clinicId,
      target_page_size: options.pageSize ?? 8,
      target_reference_date: referenceDate,
      target_reference_time: options.referenceTime ?? getLocalTimeInputValue(),
      target_search: options.search ?? '',
      target_selected_date: options.selectedDate ?? null,
      target_status: options.status ?? 'all',
    },
  )

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage(error) }
  }

  const parsed = parseReminderQueuePage(data, referenceDate)

  if (!parsed) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return { data: parsed, error: null }
}

export function parseReminderQueuePage(
  value: unknown,
  referenceDate: string,
): ReminderQueuePage | null {
  const payload = asRecord(value)

  if (
    !payload ||
    !Array.isArray(payload.reminders) ||
    !Array.isArray(payload.appointments)
  ) {
    return null
  }

  const reminders = payload.reminders
    .map(parseReminderQueueItem)
    .filter((item): item is Reminder => item !== null)
  const appointments = payload.appointments
    .map(parseReminderAppointment)
    .filter((item): item is Appointment => item !== null)
  const dateValues = Array.isArray(payload.dateOptions)
    ? payload.dateOptions.filter(
        (item): item is string => typeof item === 'string',
      )
    : null
  const pageInfo = asRecord(payload.pageInfo)
  const cursor = asRecord(pageInfo?.nextCursor)
  const summary = parseReminderQueueSummary(payload.summary)
  const selectedDateSummary = parseReminderQueueSummary(
    payload.selectedDateSummary,
  )
  const window = asRecord(payload.window)

  if (
    reminders.length !== payload.reminders.length ||
    appointments.length !== payload.appointments.length ||
    !dateValues ||
    !pageInfo ||
    typeof pageInfo.hasMore !== 'boolean' ||
    !summary ||
    !selectedDateSummary ||
    !window ||
    typeof window.from !== 'string' ||
    typeof window.to !== 'string' ||
    (payload.selectedDate !== null && typeof payload.selectedDate !== 'string')
  ) {
    return null
  }

  let nextCursor: ReminderQueueCursor | null = null

  if (cursor) {
    if (
      typeof cursor.groupId !== 'string' ||
      typeof cursor.startTime !== 'string'
    ) {
      return null
    }

    nextCursor = {
      groupId: cursor.groupId,
      startTime: cursor.startTime,
    }
  }

  return {
    appointments,
    dateOptions: getReminderDateOptionsFromDates(
      dateValues,
      new Date(`${referenceDate}T12:00:00`),
    ),
    pageInfo: {
      hasMore: pageInfo.hasMore,
      nextCursor,
    },
    reminders,
    selectedDate:
      typeof payload.selectedDate === 'string' ? payload.selectedDate : null,
    selectedDateSummary,
    summary,
    window: {
      from: window.from,
      to: window.to,
    },
  }
}

export async function createReminder(
  clinicId: string,
  reminderInput: ReminderInput,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert([mapReminderInputToInsert(clinicId, reminderInput)] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: mapReminderRecordToReminder(data as ReminderRecord, appointments, patients),
    error: null,
  }
}

export async function upsertRemindersForAppointment(
  clinicId: string,
  appointment: Appointment,
  patient: Patient | undefined,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  if (!supabase || typeof appointment.id !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  await cancelRemindersForAppointment(clinicId, appointment.id)

  const reminders = generateRemindersForAppointment(appointment, patient)
    .map(mapReminderToInput)
    .filter((reminder): reminder is ReminderInput => reminder !== null)

  if (reminders.length === 0) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert(reminders.map((reminder) => mapReminderInputToInsert(clinicId, reminder)) as never[])
    .select('*')

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapReminderRecordToReminder(record as ReminderRecord, appointments, patients),
    ),
    error: null,
  }
}

export async function updateReminderStatus(
  clinicId: string,
  reminderId: string,
  status: ReminderStatus,
  metadata?: { failedReason?: string; sentAt?: string },
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('reminders')
    .update({
      failed_reason: metadata?.failedReason ?? null,
      sent_at: metadata?.sentAt ?? null,
      status,
    } as never)
    .eq('clinic_id', clinicId)
    .eq('id', reminderId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return {
    data: mapReminderRecordToReminder(data as ReminderRecord, appointments, patients),
    error: null,
  }
}

export function markReminderSent(
  clinicId: string,
  reminderId: string,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  return updateReminderStatus(
    clinicId,
    reminderId,
    'sent',
    { sentAt: new Date().toISOString() },
    appointments,
    patients,
  )
}

export function markReminderFailed(
  clinicId: string,
  reminderId: string,
  failedReason = 'Marcado manualmente como fallido.',
  appointments: Appointment[] = [],
  patients: Patient[] = [],
) {
  return updateReminderStatus(
    clinicId,
    reminderId,
    'failed',
    { failedReason },
    appointments,
    patients,
  )
}

export async function sendReminderNow(reminderId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase.functions.invoke(
    'send-whatsapp-reminder',
    {
      body: { reminderId },
    },
  )

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return { data, error: null }
}

export async function cancelRemindersForAppointment(
  clinicId: string,
  appointmentId: AppointmentId,
) {
  if (!supabase || typeof appointmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' } as never)
    .eq('clinic_id', clinicId)
    .eq('appointment_id', appointmentId)
    .in('status', ['pending', 'scheduled'] as never)

  if (error) {
    return { data: null, error: getRemindersServiceErrorMessage() }
  }

  return { data: true, error: null }
}

function getDateFromDateTime(value: string) {
  return value.slice(0, 10)
}

function getTimeFromDateTime(value: string) {
  return value.slice(11, 16)
}

async function updateReminderBatch(
  clinicId: string,
  reminderIds: string[],
  status: 'cancelled' | 'skipped',
  metadata: Record<string, string>,
) {
  if (reminderIds.length === 0) {
    return { error: null }
  }

  const { error } = await supabase!
    .from('reminders')
    .update({ metadata, status } as never)
    .eq('clinic_id', clinicId)
    .in('id', reminderIds)
    .in('status', ['pending', 'scheduled'] as never)

  return { error }
}

function getPersistedReminderStatusNote(record: ReminderRecord) {
  if (record.status !== 'skipped') {
    return undefined
  }

  const metadata = record.metadata

  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    metadata.reason === 'appointment_passed'
  ) {
    return EXPIRED_REMINDER_STATUS_NOTE
  }

  return undefined
}

function getPersistedAppointmentSnapshot(
  record: ReminderRecord,
): Pick<Appointment, 'date' | 'status' | 'time'> | null {
  const metadata = record.metadata

  if (
    record.status !== 'skipped' ||
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    typeof metadata.appointment_date !== 'string' ||
    typeof metadata.appointment_time !== 'string' ||
    typeof metadata.appointment_status !== 'string'
  ) {
    return null
  }

  return {
    date: metadata.appointment_date,
    status: metadata.appointment_status as Appointment['status'],
    time: metadata.appointment_time,
  }
}

function parseReminderQueueItem(value: unknown): Reminder | null {
  const item = asRecord(value)

  if (
    !item ||
    typeof item.id !== 'string' ||
    typeof item.appointmentId !== 'string' ||
    typeof item.patientId !== 'string' ||
    typeof item.patientName !== 'string' ||
    typeof item.phone !== 'string' ||
    typeof item.appointmentDate !== 'string' ||
    !isAppointmentStatus(item.appointmentStatus) ||
    typeof item.appointmentTime !== 'string' ||
    typeof item.treatment !== 'string' ||
    !isReminderType(item.reminderType) ||
    typeof item.scheduledFor !== 'string' ||
    !isReminderStatus(item.status) ||
    typeof item.message !== 'string'
  ) {
    return null
  }

  return {
    appointmentDate: item.appointmentDate,
    appointmentId: item.appointmentId,
    appointmentStatus: item.appointmentStatus,
    appointmentTime: item.appointmentTime,
    ...(typeof item.failedReason === 'string'
      ? { failedReason: item.failedReason }
      : {}),
    id: item.id,
    message: item.message,
    patientId: item.patientId,
    patientName: item.patientName,
    phone: item.phone,
    reminderType: item.reminderType,
    ...(typeof item.rescheduleReason === 'string'
      ? { rescheduleReason: item.rescheduleReason }
      : {}),
    scheduledFor: item.scheduledFor,
    ...(typeof item.sentAt === 'string' ? { sentAt: item.sentAt } : {}),
    status: item.status,
    ...(typeof item.statusNote === 'string'
      ? { statusNote: item.statusNote }
      : {}),
    treatment: item.treatment,
  }
}

function parseReminderAppointment(value: unknown): Appointment | null {
  const item = asRecord(value)

  if (
    !item ||
    typeof item.id !== 'string' ||
    typeof item.patientId !== 'string' ||
    typeof item.date !== 'string' ||
    typeof item.durationMinutes !== 'number' ||
    typeof item.time !== 'string' ||
    typeof item.patient !== 'string' ||
    !isAppointmentStatus(item.status) ||
    typeof item.treatment !== 'string'
  ) {
    return null
  }

  return {
    date: item.date,
    durationMinutes: item.durationMinutes,
    id: item.id,
    patient: item.patient,
    patientId: item.patientId,
    ...(typeof item.patientPhone === 'string'
      ? { patientPhone: item.patientPhone }
      : {}),
    ...(typeof item.rescheduleReason === 'string'
      ? { rescheduleReason: item.rescheduleReason }
      : {}),
    status: item.status,
    time: item.time,
    treatment: item.treatment,
  }
}

function parseReminderQueueSummary(value: unknown): ReminderQueueSummary | null {
  const summary = asRecord(value)
  const keys = [
    'total',
    'pending',
    'scheduled',
    'sent',
    'failed',
    'cancelled',
    'skipped',
  ] as const

  if (!summary || keys.some((key) => typeof summary[key] !== 'number')) {
    return null
  }

  return {
    cancelled: summary.cancelled as number,
    failed: summary.failed as number,
    pending: summary.pending as number,
    scheduled: summary.scheduled as number,
    sent: summary.sent as number,
    skipped: summary.skipped as number,
    total: summary.total as number,
  }
}

function isAppointmentStatus(value: unknown): value is Appointment['status'] {
  return [
    'pending',
    'confirmed',
    'rescheduled',
    'cancelled',
    'completed',
    'no_show',
  ].includes(String(value))
}

function isReminderStatus(value: unknown): value is ReminderStatus {
  return [
    'pending',
    'scheduled',
    'sent',
    'failed',
    'cancelled',
    'skipped',
  ].includes(String(value))
}

function isReminderType(
  value: unknown,
): value is import('../types/Reminder').ReminderType {
  return ['24h', '2h', 'immediate'].includes(String(value))
}

function getLocalDateInputValue(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0')
  const day = String(referenceDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getLocalTimeInputValue(referenceDate = new Date()) {
  return [referenceDate.getHours(), referenceDate.getMinutes(), referenceDate.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getRemindersServiceErrorMessage(error?: { message?: string }) {
  if (error?.message?.includes('INVALID_REMINDER_QUEUE_PAGE_ARGUMENTS')) {
    return 'No pudimos cargar esa página de recordatorios.'
  }

  return 'No pudimos completar la operación de recordatorios.'
}
