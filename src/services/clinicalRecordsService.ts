import { supabase } from '../lib/supabaseClient'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
  CreateClinicalRecordInput,
} from '../types/ClinicalRecord'
import type { ClinicalRecordRecord } from '../types/database'
import type { PatientId } from '../types/Patient'
import { normalizeClinicalRecordFormValues } from '../utils/clinicalRecords'

const clinicalRecordColumns = [
  'id',
  'clinic_id',
  'patient_id',
  'created_by',
  'record_date',
  'reason',
  'diagnosis',
  'treatment',
  'observations',
  'created_at',
  'updated_at',
].join(', ')

export async function listClinicalRecordsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('clinical_records')
    .select(clinicalRecordColumns)
    .eq('clinic_id', clinicId)
    .order('record_date', { ascending: false })

  if (error) {
    return { data: null, error: getClinicalRecordsErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapClinicalRecordRecord(record as unknown as ClinicalRecordRecord),
    ),
    error: null,
  }
}

export async function listClinicalRecordsByPatient(
  clinicId: string,
  patientId: PatientId,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('clinical_records')
    .select(clinicalRecordColumns)
    .eq('clinic_id', clinicId)
    .eq('patient_id', String(patientId))
    .order('record_date', { ascending: false })

  if (error) {
    return { data: null, error: getClinicalRecordsErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapClinicalRecordRecord(record as unknown as ClinicalRecordRecord),
    ),
    error: null,
  }
}

export async function createClinicalRecord(
  input: CreateClinicalRecordInput,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('clinical_records')
    .insert(mapCreateClinicalRecordInputToRecord(input) as never)
    .select(clinicalRecordColumns)
    .single()

  if (error || !data) {
    return {
      data: null,
      error: getClinicalRecordsErrorMessage(error),
    }
  }

  return {
    data: mapClinicalRecordRecord(data as unknown as ClinicalRecordRecord),
    error: null,
  }
}

export function mapClinicalRecordRecord(
  record: ClinicalRecordRecord,
): ClinicalRecord {
  return {
    date: record.record_date.slice(0, 10),
    diagnosis: record.diagnosis?.trim() || '',
    id: record.id,
    notes: record.observations?.trim() || '',
    patientId: record.patient_id,
    reason: record.reason?.trim() || '',
    treatment: record.treatment?.trim() || '',
  }
}

export function mapClinicalRecordFormToCreateInput(
  clinicId: string,
  patientId: PatientId,
  values: ClinicalRecordFormValues,
): CreateClinicalRecordInput {
  const normalizedValues = normalizeClinicalRecordFormValues(values)

  return {
    clinicId,
    diagnosis: normalizedValues.diagnosis,
    observations: normalizedValues.notes,
    patientId,
    reason: normalizedValues.reason,
    recordDate: normalizedValues.date,
    treatment: normalizedValues.treatment,
  }
}

export function mapCreateClinicalRecordInputToRecord(
  input: CreateClinicalRecordInput,
) {
  return {
    clinic_id: input.clinicId,
    diagnosis: input.diagnosis,
    observations: input.observations || null,
    patient_id: String(input.patientId),
    reason: input.reason,
    record_date: `${input.recordDate}T12:00:00.000Z`,
    treatment: input.treatment,
  }
}

export function getClinicalRecordsErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code

  if (code === '42501') {
    return 'No tienes permiso para acceder al historial clínico.'
  }

  if (code === '23503') {
    return 'No encontramos el paciente asociado al registro clínico.'
  }

  return 'No pudimos guardar o cargar el historial clínico.'
}
