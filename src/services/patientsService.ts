import { supabase } from '../lib/supabaseClient'
import type { Patient, PatientFormValues } from '../types/Patient'
import type { PatientRecord } from '../types/database'
import { normalizePersonName } from '../utils/textNormalizers'

export interface PatientInput {
  birthDate?: string
  countryCode: string
  email?: string
  firstName: string
  lastName: string
  localPhone: string
  notes?: string
}

export interface PatientPageCursor {
  createdAt: string
  id: string
}

export interface PatientPage {
  pageInfo: {
    hasMore: boolean
    nextCursor: PatientPageCursor | null
  }
  patients: Patient[]
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
    countryCode: record.country_code,
    birthDate: record.birth_date ?? undefined,
    email: record.email ?? undefined,
    firstName: record.first_name,
    fullName: `${record.first_name} ${record.last_name}`.trim(),
    lastName: record.last_name,
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
    email: values.email.trim().toLowerCase() || undefined,
    firstName: normalizePersonName(values.firstName),
    lastName: normalizePersonName(values.lastName),
    localPhone: values.localPhone.replace(/\D/g, ''),
  }
}

export function mapPatientInputToPatientInsert(
  clinicId: string,
  input: PatientInput,
): PatientInsert {
  return {
    birth_date: input.birthDate || null,
    clinic_id: clinicId,
    country_code: input.countryCode.trim(),
    email: input.email?.trim().toLowerCase() || null,
    first_name: normalizePersonName(input.firstName),
    last_name: normalizePersonName(input.lastName),
    notes: input.notes?.trim() || null,
    phone: `${input.countryCode.trim()}${input.localPhone.replace(/\D/g, '')}`,
  }
}

export function mapPatientInputToPatientUpdate(
  input: PatientInput,
): PatientUpdate {
  return {
    birth_date: input.birthDate || null,
    country_code: input.countryCode.trim(),
    email: input.email?.trim().toLowerCase() || null,
    first_name: normalizePersonName(input.firstName),
    last_name: normalizePersonName(input.lastName),
    notes: input.notes?.trim() || null,
    phone: `${input.countryCode.trim()}${input.localPhone.replace(/\D/g, '')}`,
  }
}

export async function getPatientsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .select(
      'id, clinic_id, first_name, last_name, phone, country_code, email, birth_date, notes, created_at, updated_at',
    )
    .eq('clinic_id', clinicId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapPatientRecordToPatient(record as PatientRecord),
    ),
    error: null,
  }
}

export async function getPatientsPage(
  clinicId: string,
  searchText: string,
  referenceDate: string,
  options: {
    cursor?: PatientPageCursor | null
    pageSize?: number
  } = {},
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { cursor = null, pageSize = 12 } = options
  const patientsRpcClient = supabase as unknown as {
    rpc: (
      functionName: 'get_clinic_patients_page',
      args: {
        target_after_created_at: string | null
        target_after_id: string | null
        target_clinic_id: string
        target_page_size: number
        target_reference_date: string
        target_search: string
      },
    ) => PromiseLike<{
      data: unknown
      error: { code?: string; message?: string } | null
    }>
  }
  const { data, error } = await patientsRpcClient.rpc(
    'get_clinic_patients_page',
    {
      target_after_created_at: cursor?.createdAt ?? null,
      target_after_id: cursor?.id ?? null,
      target_clinic_id: clinicId,
      target_page_size: pageSize,
      target_reference_date: referenceDate,
      target_search: searchText,
    },
  )

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage(error) }
  }

  const page = parsePatientPage(data)

  if (!page) {
    return {
      data: null,
      error: 'No pudimos interpretar el listado de pacientes.',
    }
  }

  return { data: page, error: null }
}

export async function getPatientById(clinicId: string, patientId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('patients')
    .select(
      'id, clinic_id, first_name, last_name, phone, country_code, email, birth_date, notes, created_at, updated_at',
    )
    .eq('clinic_id', clinicId)
    .eq('id', patientId)
    .maybeSingle()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage(error) }
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
    .select(
      'id, clinic_id, first_name, last_name, phone, country_code, email, birth_date, notes, created_at, updated_at',
    )
    .single()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage(error) }
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
    .select(
      'id, clinic_id, first_name, last_name, phone, country_code, email, birth_date, notes, created_at, updated_at',
    )
    .single()

  if (error) {
    return { data: null, error: getPatientServiceErrorMessage(error) }
  }

  return {
    data: mapPatientRecordToPatient(data as PatientRecord),
    error: null,
  }
}

export function parsePatientPage(value: unknown): PatientPage | null {
  const payload = asRecord(value)
  const pageInfo = asRecord(payload?.pageInfo)

  if (!payload || !Array.isArray(payload.patients) || !pageInfo) {
    return null
  }

  if (typeof pageInfo.hasMore !== 'boolean') {
    return null
  }

  const nextCursorPayload = pageInfo.nextCursor
  const nextCursorRecord =
    nextCursorPayload === null ? null : asRecord(nextCursorPayload)

  if (
    nextCursorPayload !== null &&
    (!nextCursorRecord ||
      typeof nextCursorRecord.createdAt !== 'string' ||
      typeof nextCursorRecord.id !== 'string')
  ) {
    return null
  }

  const patients = payload.patients.map(parsePatientPageItem)

  if (patients.some((patient) => patient === null)) {
    return null
  }

  return {
    pageInfo: {
      hasMore: pageInfo.hasMore,
      nextCursor:
        nextCursorRecord === null
          ? null
          : {
              createdAt: nextCursorRecord.createdAt as string,
              id: nextCursorRecord.id as string,
            },
    },
    patients: patients as Patient[],
  }
}

function parsePatientPageItem(value: unknown): Patient | null {
  const patient = asRecord(value)

  if (
    !patient ||
    typeof patient.id !== 'string' ||
    typeof patient.fullName !== 'string' ||
    typeof patient.firstName !== 'string' ||
    typeof patient.lastName !== 'string' ||
    typeof patient.phone !== 'string' ||
    typeof patient.countryCode !== 'string' ||
    patient.status !== 'active'
  ) {
    return null
  }

  if (
    patient.email !== null &&
    patient.email !== undefined &&
    typeof patient.email !== 'string'
  ) {
    return null
  }

  if (
    patient.birthDate !== null &&
    patient.birthDate !== undefined &&
    typeof patient.birthDate !== 'string'
  ) {
    return null
  }

  if (
    patient.lastVisit !== null &&
    patient.lastVisit !== undefined &&
    typeof patient.lastVisit !== 'string'
  ) {
    return null
  }

  if (
    patient.nextAppointment !== null &&
    patient.nextAppointment !== undefined &&
    typeof patient.nextAppointment !== 'string'
  ) {
    return null
  }

  return {
    birthDate:
      typeof patient.birthDate === 'string' ? patient.birthDate : undefined,
    countryCode: patient.countryCode,
    email: typeof patient.email === 'string' ? patient.email : undefined,
    firstName: patient.firstName,
    fullName: patient.fullName,
    id: patient.id,
    lastName: patient.lastName,
    lastVisit:
      typeof patient.lastVisit === 'string'
        ? patient.lastVisit
        : 'Sin registro',
    nextAppointment:
      typeof patient.nextAppointment === 'string'
        ? patient.nextAppointment
        : null,
    phone: patient.phone,
    status: 'active',
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function getPatientServiceErrorMessage(error?: {
  code?: string
  message?: string
}) {
  if (error?.code === '23505') {
    if (error.message?.includes('patients_clinic_phone_normalized_uidx')) {
      return 'El teléfono ya está registrado en otro paciente.'
    }

    if (error.message?.includes('patients_clinic_email_normalized_uidx')) {
      return 'El correo ya está registrado en otro paciente.'
    }

    return 'Ya existe un paciente con esos datos.'
  }

  if (error?.message?.includes('INVALID_PATIENT_PAGE_ARGUMENTS')) {
    return 'No pudimos cargar esa página de pacientes.'
  }

  return 'No pudimos completar la operación de pacientes.'
}
