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
    failed_reason: input.failedReason ?? null,
    message: input.message,
    patient_id: input.patientId,
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

function getRemindersServiceErrorMessage() {
  return 'No pudimos completar la operación de recordatorios.'
}
