import { supabase } from '../lib/supabaseClient'
import type {
  Appointment,
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
  createAppointmentConfirmedLog,
  createAppointmentCreatedLog,
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
    status: input.status === 'completed' ? 'confirmed' : input.status,
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
  }

  const { data: logs, error: logsError } = await supabase
    .from('appointment_change_logs')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true })

  if (logsError) {
    return { data: null, error: getAppointmentServiceErrorMessage() }
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
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

  const logEntry = createAppointmentConfirmedLog()
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
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
    return { data: null, error: getAppointmentServiceErrorMessage() }
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

function getAppointmentServiceErrorMessage() {
  return 'No pudimos completar la operación de citas.'
}
