import { supabase } from '../lib/supabaseClient'
import type { Appointment, AppointmentId } from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type {
  ReminderRecord,
  ReminderRecordStatus,
  ReminderRecordType,
} from '../types/database'
import type { Reminder, ReminderStatus } from '../types/Reminder'
import {
  generateRemindersForAppointment,
} from '../utils/reminders'
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

export function mapReminderRecordToReminder(
  record: ReminderRecord,
  appointments: Appointment[] = [],
  patients: Patient[] = [],
): Reminder {
  const appointment = appointments.find(
    (item) => item.id === record.appointment_id,
  )
  const patient = patients.find((item) => item.id === record.patient_id)

  return {
    appointmentDate: appointment?.date ?? getDateFromDateTime(record.scheduled_at),
    appointmentId: record.appointment_id,
    appointmentStatus: appointment?.status ?? 'pending',
    appointmentTime: appointment?.time ?? getTimeFromDateTime(record.scheduled_at),
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

  const updateResults = await Promise.all([
    updateReminderBatch(clinicId, cancelledIds, 'cancelled', {
      reason: 'appointment_cancelled',
    }),
    updateReminderBatch(clinicId, skippedIds, 'skipped', {
      note: EXPIRED_REMINDER_METADATA_NOTE,
      reason: 'appointment_passed',
    }),
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

function getRemindersServiceErrorMessage() {
  return 'No pudimos completar la operación de recordatorios.'
}
