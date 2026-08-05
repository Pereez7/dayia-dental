import { supabase } from '../lib/supabaseClient'
import type {
  Appointment,
  AppointmentAgendaCursor,
  AppointmentAgendaSnapshot,
  AppointmentChangeLogEntry,
  AppointmentChangeLogType,
  AppointmentFormValues,
  AppointmentId,
  AppointmentStatus,
} from '../types/Appointment'
import type { Patient } from '../types/Patient'
import type {
  AppointmentChangeLogRecord,
  AppointmentRecord,
} from '../types/database'
import type { AppointmentReasonPayload } from '../utils/appointmentReasons'
import {
  createAppointmentCancelledLog,
  createAppointmentCompletedLog,
  createAppointmentConfirmedLog,
  createAppointmentCreatedLog,
  createAppointmentNoShowLog,
  createAppointmentRescheduledLog,
} from '../utils/appointmentChangeLog'

export interface AppointmentInput {
  date: string
  durationMinutes: number
  patientId: string
  patientName: string
  status: AppointmentStatus
  time: string
  treatment: string
  treatmentId?: string | null
}

interface AppointmentUpdateInput {
  cancelReason?: string | null
  date?: string
  durationMinutes?: number
  rescheduleReason?: string | null
  status?: AppointmentStatus
  time?: string
}

interface AppointmentAvailabilityRecord {
  appointment_date: string
  duration_minutes: number
  id: string
  patient_id: string
  reason: string | null
  start_time: string
  status: AppointmentStatus
}

type AppointmentInsert = Omit<
  AppointmentRecord,
  'created_at' | 'id' | 'updated_at'
>

type AppointmentLogInsert = Omit<
  AppointmentChangeLogRecord,
  'created_at' | 'id'
>

export function mapAppointmentRecordToAppointment(
  record: AppointmentRecord,
  patients: Patient[] = [],
  changeLogs: AppointmentChangeLogRecord[] = [],
): Appointment {
  const patient = patients.find((item) => item.id === record.patient_id)

  return {
    id: record.id,
    cancellationReason: record.cancel_reason ?? undefined,
    changeLog: changeLogs
      .filter((log) => log.appointment_id === record.id)
      .map(mapAppointmentChangeLogRecordToEntry),
    date: record.appointment_date,
    durationMinutes: record.duration_minutes,
    patient: patient?.fullName ?? 'Paciente no encontrado',
    patientId: record.patient_id,
    ...(patient?.phone ? { patientPhone: patient.phone } : {}),
    rescheduleReason: record.reschedule_reason ?? undefined,
    status: record.status,
    time: normalizeDbTime(record.start_time),
    treatment: record.reason ?? 'Tratamiento no registrado',
  }
}

export function mapAppointmentFormValuesToAppointmentInput(
  values: AppointmentFormValues,
): AppointmentInput | null {
  if (typeof values.patientId !== 'string') {
    return null
  }

  return {
    date: values.date,
    durationMinutes: values.durationMinutes,
    patientId: values.patientId,
    patientName: values.patient,
    status: values.status,
    time: values.time,
    treatment: values.treatment,
    treatmentId: null,
  }
}

export function mapAppointmentInputToInsert(
  clinicId: string,
  input: AppointmentInput,
): AppointmentInsert {
  return {
    appointment_date: input.date,
    cancel_reason: null,
    clinic_id: clinicId,
    duration_minutes: input.durationMinutes,
    patient_id: input.patientId,
    reason: input.treatment,
    reschedule_reason: null,
    start_time: input.time,
    status: input.status,
    treatment_id: input.treatmentId ?? null,
  }
}

export function mapAppointmentChangeLogRecordToEntry(
  record: AppointmentChangeLogRecord,
): AppointmentChangeLogEntry {
  return {
    id: record.id,
    createdAt: record.created_at,
    description: record.description ?? '',
    metadata: {
      ...(record.from_date ? { fromDate: record.from_date } : {}),
      ...(record.from_time ? { fromTime: normalizeDbTime(record.from_time) } : {}),
      ...(record.to_date ? { toDate: record.to_date } : {}),
      ...(record.to_time ? { toTime: normalizeDbTime(record.to_time) } : {}),
    },
    type: record.type as AppointmentChangeLogType,
  }
}

export async function getAppointmentsByClinic(
  clinicId: string,
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (appointmentsError) {
    return {
      data: null,
      error: getAppointmentServiceErrorMessage(appointmentsError),
    }
  }

  const { data: logs, error: logsError } = await supabase
    .from('appointment_change_logs')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true })

  if (logsError) {
    return { data: null, error: getAppointmentServiceErrorMessage(logsError) }
  }

  return {
    data: (appointments ?? []).map((record) =>
      mapAppointmentRecordToAppointment(
        record as AppointmentRecord,
        patients,
        (logs ?? []) as AppointmentChangeLogRecord[],
      ),
    ),
    error: null,
  }
}

export async function getAppointmentAgendaSnapshot(
  clinicId: string,
  selectedDate: string,
  referenceDate: string,
  options: {
    cursor?: AppointmentAgendaCursor | null
    pageSize?: number
  } = {},
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { cursor = null, pageSize = 20 } = options
  const agendaRpcClient = supabase as unknown as {
    rpc: (
      functionName: 'get_clinic_agenda_snapshot',
      args: {
        target_after_id: string | null
        target_after_start_time: string | null
        target_clinic_id: string
        target_page_size: number
        target_reference_date: string
        target_selected_date: string
      },
    ) => PromiseLike<{ data: unknown; error: unknown }>
  }
  const { data, error } = await agendaRpcClient.rpc(
    'get_clinic_agenda_snapshot',
    {
      target_after_id: cursor?.id ?? null,
      target_after_start_time: cursor?.startTime ?? null,
      target_clinic_id: clinicId,
      target_page_size: pageSize,
      target_reference_date: referenceDate,
      target_selected_date: selectedDate,
    },
  )

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  const snapshot = parseAppointmentAgendaSnapshot(data)

  if (!snapshot) {
    return {
      data: null,
      error: 'No pudimos interpretar la agenda del consultorio.',
    }
  }

  return {
    data: snapshot,
    error: null,
  }
}

export async function getAppointmentAvailabilityByDate(
  clinicId: string,
  date: string,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, patient_id, appointment_date, start_time, duration_minutes, status, reason',
    )
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed', 'rescheduled'] as never)
    .order('start_time', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  return {
    data: ((data ?? []) as unknown as AppointmentAvailabilityRecord[]).map((record) => ({
      date: record.appointment_date,
      durationMinutes: record.duration_minutes,
      id: record.id,
      patient: '',
      patientId: record.patient_id,
      status: record.status,
      time: normalizeDbTime(record.start_time),
      treatment: record.reason ?? 'Tratamiento no registrado',
    })) as Appointment[],
    error: null,
  }
}

export async function getAppointmentsByDate(
  clinicId: string,
  date: string,
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date)
    .order('start_time', { ascending: true })

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapAppointmentRecordToAppointment(record as AppointmentRecord, patients),
    ),
    error: null,
  }
}

export async function getAppointmentsByPatient(
  clinicId: string,
  patientId: string,
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: true })

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapAppointmentRecordToAppointment(record as AppointmentRecord, patients),
    ),
    error: null,
  }
}

export async function createAppointment(
  clinicId: string,
  appointmentInput: AppointmentInput,
  patients: Patient[] = [],
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert([mapAppointmentInputToInsert(clinicId, appointmentInput)] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  const appointment = mapAppointmentRecordToAppointment(
    data as AppointmentRecord,
    patients,
  )
  const logEntry = createAppointmentCreatedLog(appointment)
  await createAppointmentChangeLog(clinicId, appointment.id, {
    description: logEntry.description,
    metadata: logEntry.metadata,
    type: logEntry.type,
  })

  return {
    data: {
      ...appointment,
      changeLog: [logEntry],
    },
    error: null,
  }
}

export async function updateAppointmentStatus(
  clinicId: string,
  appointmentId: AppointmentId,
  status: AppointmentStatus,
  reasonPayload?: AppointmentReasonPayload,
  currentAppointment?: Appointment,
) {
  if (status === 'cancelled') {
    return cancelAppointment(clinicId, appointmentId, reasonPayload, currentAppointment)
  }

  const logEntry =
    status === 'completed'
      ? createAppointmentCompletedLog()
      : status === 'no_show'
        ? createAppointmentNoShowLog()
        : createAppointmentConfirmedLog()
  return updateAppointment(clinicId, appointmentId, {
    currentAppointment,
    logEntry,
    updateValues: { status },
  })
}

export async function cancelAppointment(
  clinicId: string,
  appointmentId: AppointmentId,
  cancelData?: AppointmentReasonPayload,
  currentAppointment?: Appointment,
) {
  const logEntry = createAppointmentCancelledLog(cancelData)

  return updateAppointment(clinicId, appointmentId, {
    logEntry,
    updateValues: {
      cancelReason: cancelData?.reasonDetail ?? cancelData?.reason ?? null,
      status: 'cancelled',
    },
    currentAppointment,
  })
}

export async function rescheduleAppointment(
  clinicId: string,
  appointmentId: AppointmentId,
  rescheduleData: {
    date: string
    durationMinutes: number
    reasonPayload?: AppointmentReasonPayload
    time: string
  },
  currentAppointment: Appointment,
) {
  const logEntry = createAppointmentRescheduledLog(
    currentAppointment,
    {
      date: rescheduleData.date,
      time: rescheduleData.time,
    },
    rescheduleData.reasonPayload,
  )

  return updateAppointment(clinicId, appointmentId, {
    logEntry,
    updateValues: {
      date: rescheduleData.date,
      durationMinutes: rescheduleData.durationMinutes,
      rescheduleReason:
        rescheduleData.reasonPayload?.reasonDetail ??
        rescheduleData.reasonPayload?.reason ??
        null,
      status: 'rescheduled',
      time: rescheduleData.time,
    },
    currentAppointment,
  })
}

export async function createAppointmentChangeLog(
  clinicId: string,
  appointmentId: AppointmentId,
  logInput: {
    description: string
    metadata?: Record<string, string>
    type: AppointmentChangeLogType
  },
) {
  if (!supabase || typeof appointmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const insertValues: AppointmentLogInsert = {
    appointment_id: appointmentId,
    clinic_id: clinicId,
    description: logInput.description,
    from_date: logInput.metadata?.fromDate ?? null,
    from_time: logInput.metadata?.fromTime ?? null,
    to_date: logInput.metadata?.toDate ?? null,
    to_time: logInput.metadata?.toTime ?? null,
    type: logInput.type,
  }

  const { data, error } = await supabase
    .from('appointment_change_logs')
    .insert([insertValues] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  return {
    data: mapAppointmentChangeLogRecordToEntry(
      data as AppointmentChangeLogRecord,
    ),
    error: null,
  }
}

async function updateAppointment(
  clinicId: string,
  appointmentId: AppointmentId,
  {
    currentAppointment,
    logEntry,
    updateValues,
  }: {
    currentAppointment?: Appointment
    logEntry: AppointmentChangeLogEntry
    updateValues: AppointmentUpdateInput
  },
) {
  if (!supabase || typeof appointmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(mapAppointmentUpdateToRecord(updateValues) as never)
    .eq('clinic_id', clinicId)
    .eq('id', appointmentId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  await createAppointmentChangeLog(clinicId, appointmentId, {
    description: logEntry.description,
    metadata: logEntry.metadata,
    type: logEntry.type,
  })

  const appointment = mapAppointmentRecordToAppointment(data as AppointmentRecord)

  return {
    data: {
      ...appointment,
      patient: currentAppointment?.patient ?? appointment.patient,
      patientPhone: currentAppointment?.patientPhone,
      treatment: currentAppointment?.treatment ?? appointment.treatment,
      changeLog: [...(currentAppointment?.changeLog ?? []), logEntry],
    },
    error: null,
  }
}

function mapAppointmentUpdateToRecord(input: AppointmentUpdateInput) {
  return {
    ...(input.cancelReason !== undefined
      ? { cancel_reason: input.cancelReason }
      : {}),
    ...(input.date ? { appointment_date: input.date } : {}),
    ...(input.durationMinutes ? { duration_minutes: input.durationMinutes } : {}),
    ...(input.rescheduleReason !== undefined
      ? { reschedule_reason: input.rescheduleReason }
      : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.time ? { start_time: input.time } : {}),
  }
}

function normalizeDbTime(time: string) {
  return time.slice(0, 5)
}

export function parseAppointmentAgendaSnapshot(
  value: unknown,
): AppointmentAgendaSnapshot | null {
  const snapshot = asRecord(value)
  const pageInfo = asRecord(snapshot?.pageInfo)
  const statusSummary = asRecord(snapshot?.statusSummary)
  const nextCursor = pageInfo?.nextCursor
  const cursorRecord = nextCursor === null ? null : asRecord(nextCursor)
  const summaryKeys = [
    'cancelled',
    'completed',
    'confirmed',
    'no_show',
    'pending',
    'rescheduled',
    'total',
  ] as const

  if (
    !snapshot ||
    !Array.isArray(snapshot.appointments) ||
    !snapshot.appointments.every(isAgendaAppointment) ||
    !Array.isArray(snapshot.availabilityAppointments) ||
    !snapshot.availabilityAppointments.every(isAgendaAppointment) ||
    !Array.isArray(snapshot.dayOptions) ||
    !snapshot.dayOptions.every((date) => typeof date === 'string') ||
    typeof snapshot.selectedDate !== 'string' ||
    !pageInfo ||
    typeof pageInfo.hasMore !== 'boolean' ||
    !statusSummary ||
    summaryKeys.some(
      (key) =>
        !Number.isInteger(statusSummary[key]) ||
        (statusSummary[key] as number) < 0,
    ) ||
    (nextCursor !== null &&
      (!cursorRecord ||
        typeof cursorRecord.id !== 'string' ||
        typeof cursorRecord.startTime !== 'string'))
  ) {
    return null
  }

  return value as AppointmentAgendaSnapshot
}

function isAgendaAppointment(value: unknown) {
  const appointment = asRecord(value)

  return Boolean(
    appointment &&
      (typeof appointment.id === 'string' ||
        typeof appointment.id === 'number') &&
      typeof appointment.date === 'string' &&
      typeof appointment.patient === 'string' &&
      typeof appointment.status === 'string' &&
      typeof appointment.time === 'string' &&
      typeof appointment.treatment === 'string' &&
      (appointment.patientPhone === undefined ||
        typeof appointment.patientPhone === 'string'),
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getAppointmentServiceErrorMessage(error?: { code?: string }) {
  if (error?.code === '23514') {
    return 'La base de datos todavía no admite este estado de cita. Aplica la migración pendiente e intenta nuevamente.'
  }

  if (error?.code === '42501') {
    return 'No tienes permiso para actualizar esta cita.'
  }

  return 'No pudimos completar la operación. Intenta nuevamente.'
}
