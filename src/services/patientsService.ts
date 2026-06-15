import { supabase } from '../lib/supabaseClient'
import type { Patient, PatientFormValues } from '../types/Patient'
import type { PatientRecord } from '../types/database'
import { normalizeSentenceText } from '../utils/textNormalizers'

export interface PatientInput {
  birthDate?: string
  countryCode: string
  email?: string
  firstName: string
  lastName: string
  localPhone: string
  notes?: string
}

type PatientInsert = Omit<
  PatientRecord,
  'created_at' | 'id' | 'updated_at'
>

type PatientUpdate = Partial<
  Omit<PatientInsert, 'clinic_id'>
>

export function mapPatientRecordToPatient(record: PatientRecord): Patient {
  return {
    id: record.id,
    birthDate: record.birth_date ?? undefined,
    email: record.email ?? undefined,
    fullName: `${record.first_name} ${record.last_name}`.trim(),
    lastVisit: 'Sin registro',
    nextAppointment: null,
    phone: record.phone,
    status: 'active',
  }
}

export function mapPatientFormValuesToPatientInput(
  values: PatientFormValues,
): PatientInput {
  return {
    birthDate: values.birthDate || undefined,
    countryCode: values.countryCode.trim(),
    email: values.email.trim() || undefined,
    firstName: normalizeSentenceText(values.firstName),
    lastName: normalizeSentenceText(values.lastName),
    localPhone: values.localPhone.trim(),
  }
}

export function mapPatientInputToPatientInsert(
  clinicId: string,
  input: PatientInput,
): PatientInsert {
  return {
    birth_date: input.birthDate || null,
    clinic_id: clinicId,
    country_code: input.countryCode,
    email: input.email?.trim() || null,
    first_name: normalizeSentenceText(input.firstName),
    last_name: normalizeSentenceText(input.lastName),
    notes: input.notes?.trim() || null,
    phone: `${input.countryCode}${input.localPhone.trim()}`,
  }
}

export function mapPatientInputToPatientUpdate(
  input: PatientInput,
): PatientUpdate {
  return {
    birth_date: input.birthDate || null,
    country_code: input.countryCode,
    email: input.email?.trim() || null,
    first_name: normalizeSentenceText(input.firstName),
    last_name: normalizeSentenceText(input.lastName),
    notes: input.notes?.trim() || null,
    phone: `${input.countryCode}${input.localPhone.trim()}`,
  }
}

export async function getPatientsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapPatientRecordToPatient(record as PatientRecord),
    ),
    error: null,
  }
}

export async function getPatientById(clinicId: string, patientId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', patientId)
    .maybeSingle()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage() }
  }

  return {
    data: data ? mapPatientRecordToPatient(data as PatientRecord) : null,
    error: null,
  }
}

export async function createPatient(
  clinicId: string,
  patientInput: PatientInput,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .insert([mapPatientInputToPatientInsert(clinicId, patientInput)] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage() }
  }

  return {
    data: mapPatientRecordToPatient(data as PatientRecord),
    error: null,
  }
}

export async function updatePatient(
  clinicId: string,
  patientId: string,
  patientInput: PatientInput,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .update(mapPatientInputToPatientUpdate(patientInput) as never)
    .eq('clinic_id', clinicId)
    .eq('id', patientId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage() }
  }

  return {
    data: mapPatientRecordToPatient(data as PatientRecord),
    error: null,
  }
}

function getPatientServiceErrorMessage() {
  return 'No pudimos completar la operación de pacientes.'
}
