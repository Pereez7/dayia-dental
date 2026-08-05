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
  createAppointmentNoShowLog,
} from '../utils/appointmentChangeLog'
import type { Treatment } from '../types/Treatment'

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

interface AppointmentSchedulingRpcClient {
  rpc: (
    functionName:
      | 'create_clinic_appointment'
      | 'reschedule_clinic_appointment',
    args: Record<string, string>,
  ) => PromiseLike<{
    data: unknown
    error: { code?: string; message?: string } | null
  }>
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
  treatments: Treatment[] = [],
): AppointmentInput | null {
  if (typeof values.patientId !== 'string') {
    return null
  }

  const treatment = treatments.find(
    (item) => item.name === values.treatment && typeof item.id === 'string',
  )

  return {
    date: values.date,
    durationMinutes: values.durationMinutes,
    patientId: values.patientId,
    patientName: values.patient,
    status: values.status,
    time: values.time,
    treatment: values.treatment,
    treatmentId: typeof treatment?.id === 'string' ? treatment.id : null,
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

  if (!appointmentInput.treatmentId) {
    return {
      data: null,
      error: 'Selecciona un tratamiento activo antes de guardar la cita.',
    }
  }

  const schedulingClient = supabase as unknown as AppointmentSchedulingRpcClient
  const { data, error } = await schedulingClient.rpc('create_clinic_appointment', {
    target_clinic_id: clinicId,
    target_date: appointmentInput.date,
    target_patient_id: appointmentInput.patientId,
    target_start_time: appointmentInput.time,
    target_status: appointmentInput.status,
    target_treatment_id: appointmentInput.treatmentId,
  })

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  const mutation = parseAppointmentMutationResult(data)

  if (!mutation) {
    return {
      data: null,
      error: 'No pudimos confirmar la cita registrada.',
    }
  }

  const appointment = mapAppointmentRecordToAppointment(
    mutation.appointment,
    patients,
    [mutation.changeLog],
  )

  return {
    data: appointment,
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
    reasonPayload?: AppointmentReasonPayload
    time: string
  },
  currentAppointment: Appointment,
) {
  if (!supabase || typeof appointmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const reason =
    rescheduleData.reasonPayload?.reasonDetail ??
    rescheduleData.reasonPayload?.reason ??
    ''

  const schedulingClient = supabase as unknown as AppointmentSchedulingRpcClient
  const { data, error } = await schedulingClient.rpc(
    'reschedule_clinic_appointment',
    {
      target_appointment_id: appointmentId,
      target_clinic_id: clinicId,
      target_date: rescheduleData.date,
      target_expected_date: currentAppointment.date,
      target_expected_start_time: currentAppointment.time,
      target_reason: reason,
      target_start_time: rescheduleData.time,
    },
  )

  if (error) {
    return { data: null, error: getAppointmentServiceErrorMessage(error) }
  }

  const mutation = parseAppointmentMutationResult(data)

  if (!mutation) {
    return {
      data: null,
      error: 'No pudimos confirmar la reprogramación.',
    }
  }

  const appointment = mapAppointmentRecordToAppointment(
    mutation.appointment,
    [],
    [mutation.changeLog],
  )

  return {
    data: {
      ...appointment,
      patient: currentAppointment.patient,
      patientPhone: currentAppointment.patientPhone,
      treatment: currentAppointment.treatment,
      changeLog: [
        ...(currentAppointment.changeLog ?? []),
        mapAppointmentChangeLogRecordToEntry(mutation.changeLog),
      ],
    },
    error: null,
  }
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

function parseAppointmentMutationResult(value: unknown): {
  appointment: AppointmentRecord
  changeLog: AppointmentChangeLogRecord
} | null {
  const payload = asRecord(value)
  const appointment = asRecord(payload?.appointment)
  const changeLog = asRecord(payload?.changeLog)

  if (
    !appointment ||
    typeof appointment.id !== 'string' ||
    typeof appointment.clinic_id !== 'string' ||
    typeof appointment.patient_id !== 'string' ||
    typeof appointment.appointment_date !== 'string' ||
    typeof appointment.start_time !== 'string' ||
    typeof appointment.duration_minutes !== 'number' ||
    typeof appointment.status !== 'string' ||
    !changeLog ||
    typeof changeLog.id !== 'string' ||
    typeof changeLog.appointment_id !== 'string' ||
    typeof changeLog.clinic_id !== 'string' ||
    typeof changeLog.created_at !== 'string' ||
    typeof changeLog.type !== 'string'
  ) {
    return null
  }

  return {
    appointment: appointment as unknown as AppointmentRecord,
    changeLog: changeLog as unknown as AppointmentChangeLogRecord,
  }
}

export function getAppointmentServiceErrorMessage(error?: {
  code?: string
  message?: string
}) {
  const errorMessage = error?.message ?? ''

  if (errorMessage.includes('APPOINTMENT_SLOT_CONFLICT')) {
    return 'Ese horario acaba de ser ocupado. Elige otra hora.'
  }

  if (errorMessage.includes('APPOINTMENT_PATIENT_DAY_CONFLICT')) {
    return 'Este paciente ya tiene una cita activa ese día.'
  }

  if (errorMessage.includes('APPOINTMENT_CLOSED_DAY')) {
    return 'El consultorio está cerrado ese día.'
  }

  if (errorMessage.includes('APPOINTMENT_OUTSIDE_BUSINESS_HOURS')) {
    return 'La cita queda fuera del horario de atención.'
  }

  if (errorMessage.includes('APPOINTMENT_INVALID_SLOT')) {
    return 'La hora elegida no coincide con el intervalo del consultorio.'
  }

  if (errorMessage.includes('APPOINTMENT_SCHEDULE_NOT_CONFIGURED')) {
    return 'Configura los horarios del consultorio antes de registrar citas.'
  }

  if (errorMessage.includes('APPOINTMENT_INVALID_TREATMENT')) {
    return 'El tratamiento seleccionado ya no está disponible.'
  }

  if (errorMessage.includes('APPOINTMENT_STALE')) {
    return 'La cita cambió mientras la revisabas. Actualiza la agenda e inténtalo nuevamente.'
  }

  if (errorMessage.includes('APPOINTMENT_CANNOT_RESCHEDULE')) {
    return 'Esta cita ya no admite reprogramación.'
  }

  if (errorMessage.includes('APPOINTMENT_NO_SCHEDULE_CHANGE')) {
    return 'Selecciona una fecha o una hora diferente.'
  }

  if (
    errorMessage.includes('APPOINTMENT_INVALID_INPUT') ||
    errorMessage.includes('APPOINTMENT_INVALID_STATUS') ||
    errorMessage.includes('APPOINTMENT_INVALID_REASON')
  ) {
    return 'Revisa los datos de la cita antes de continuar.'
  }

  if (errorMessage.includes('APPOINTMENT_NOT_FOUND')) {
    return 'No encontramos la cita seleccionada.'
  }

  if (error?.code === '23514') {
    return 'La base de datos todavía no admite este estado de cita. Aplica la migración pendiente e intenta nuevamente.'
  }

  if (error?.code === '42501') {
    return 'No tienes permiso para actualizar esta cita.'
  }

  return 'No pudimos completar la operación. Intenta nuevamente.'
}
