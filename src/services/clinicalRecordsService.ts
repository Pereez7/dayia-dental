import { supabase } from '../lib/supabaseClient'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
  CreateClinicalRecordInput,
} from '../types/ClinicalRecord'
import type { ClinicalRecordRecord } from '../types/database'
import type { PatientId } from '../types/Patient'
import {
  type ClinicalHistoryPeriodFilter,
  type ClinicalRecordPatientGroup,
  type GlobalClinicalRecord,
  normalizeClinicalRecordFormValues,
} from '../utils/clinicalRecords'

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

export interface ClinicalRecordPageCursor {
  id: string
  recordDate: string
}

export interface ClinicalRecordPageSummary {
  firstRecordDate: string | null
  lastRecordDate: string | null
  totalRecords: number
}

export interface ClinicalRecordPage {
  pageInfo: {
    hasMore: boolean
    nextCursor: ClinicalRecordPageCursor | null
  }
  records: ClinicalRecord[]
  summary: ClinicalRecordPageSummary
}

export interface GlobalClinicalHistoryCursor {
  latestRecordDate: string
  patientId: string
}

export interface GlobalClinicalHistorySummary {
  patientsWithHistory: number
  recordsThisMonth: number
  totalRecords: number
}

export interface GlobalClinicalHistoryPage {
  groups: ClinicalRecordPatientGroup[]
  pageInfo: {
    hasMore: boolean
    nextCursor: GlobalClinicalHistoryCursor | null
  }
  summary: GlobalClinicalHistorySummary
}

export async function getPatientClinicalRecordsPage(
  clinicId: string,
  patientId: PatientId,
  options: {
    cursor?: ClinicalRecordPageCursor | null
    pageSize?: number
  } = {},
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { cursor = null, pageSize = 8 } = options
  const patientHistoryRpcClient = supabase as unknown as {
    rpc: (
      functionName: 'get_patient_clinical_records_page',
      args: {
        target_after_id: string | null
        target_after_record_date: string | null
        target_clinic_id: string
        target_page_size: number
        target_patient_id: string
      },
    ) => PromiseLike<{
      data: unknown
      error: { code?: string; message?: string } | null
    }>
  }
  const { data, error } = await patientHistoryRpcClient.rpc(
    'get_patient_clinical_records_page',
    {
      target_after_id: cursor?.id ?? null,
      target_after_record_date: cursor?.recordDate ?? null,
      target_clinic_id: clinicId,
      target_page_size: pageSize,
      target_patient_id: String(patientId),
    },
  )

  if (error) {
    return { data: null, error: getClinicalRecordsErrorMessage(error) }
  }

  const page = parseClinicalRecordPage(data)

  return page
    ? { data: page, error: null }
    : { data: null, error: 'No pudimos interpretar el historial clínico.' }
}

export async function getClinicClinicalHistoryPage(
  clinicId: string,
  searchText: string,
  period: ClinicalHistoryPeriodFilter,
  referenceDate: string,
  options: {
    cursor?: GlobalClinicalHistoryCursor | null
    pageSize?: number
  } = {},
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { cursor = null, pageSize = 8 } = options
  const globalHistoryRpcClient = supabase as unknown as {
    rpc: (
      functionName: 'get_clinic_clinical_history_page',
      args: {
        target_after_latest_record_date: string | null
        target_after_patient_id: string | null
        target_clinic_id: string
        target_page_size: number
        target_period: ClinicalHistoryPeriodFilter
        target_reference_date: string
        target_search: string
      },
    ) => PromiseLike<{
      data: unknown
      error: { code?: string; message?: string } | null
    }>
  }
  const { data, error } = await globalHistoryRpcClient.rpc(
    'get_clinic_clinical_history_page',
    {
      target_after_latest_record_date: cursor?.latestRecordDate ?? null,
      target_after_patient_id: cursor?.patientId ?? null,
      target_clinic_id: clinicId,
      target_page_size: pageSize,
      target_period: period,
      target_reference_date: referenceDate,
      target_search: searchText,
    },
  )

  if (error) {
    return { data: null, error: getClinicalRecordsErrorMessage(error) }
  }

  const page = parseGlobalClinicalHistoryPage(data)

  return page
    ? { data: page, error: null }
    : { data: null, error: 'No pudimos interpretar el historial clínico.' }
}

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

export function parseClinicalRecordPage(value: unknown): ClinicalRecordPage | null {
  const payload = asRecord(value)
  const pageInfo = asRecord(payload?.pageInfo)
  const summary = asRecord(payload?.summary)

  if (!payload || !Array.isArray(payload.records) || !pageInfo || !summary) {
    return null
  }

  const records = payload.records.map(parseClinicalRecordPayload)
  const totalRecords = parseNonNegativeInteger(summary.totalRecords)
  const nextCursor = parseClinicalRecordCursor(pageInfo.nextCursor)

  if (
    records.some((record) => record === null) ||
    typeof pageInfo.hasMore !== 'boolean' ||
    totalRecords === null ||
    nextCursor === undefined ||
    !isNullableString(summary.firstRecordDate) ||
    !isNullableString(summary.lastRecordDate)
  ) {
    return null
  }

  return {
    pageInfo: {
      hasMore: pageInfo.hasMore,
      nextCursor,
    },
    records: records as ClinicalRecord[],
    summary: {
      firstRecordDate: normalizeNullableDate(summary.firstRecordDate),
      lastRecordDate: normalizeNullableDate(summary.lastRecordDate),
      totalRecords,
    },
  }
}

export function parseGlobalClinicalHistoryPage(
  value: unknown,
): GlobalClinicalHistoryPage | null {
  const payload = asRecord(value)
  const pageInfo = asRecord(payload?.pageInfo)
  const summary = asRecord(payload?.summary)

  if (!payload || !Array.isArray(payload.groups) || !pageInfo || !summary) {
    return null
  }

  const groups = payload.groups.map(parseClinicalHistoryGroup)
  const nextCursor = parseGlobalClinicalHistoryCursor(pageInfo.nextCursor)
  const totalRecords = parseNonNegativeInteger(summary.totalRecords)
  const recordsThisMonth = parseNonNegativeInteger(summary.recordsThisMonth)
  const patientsWithHistory = parseNonNegativeInteger(
    summary.patientsWithHistory,
  )

  if (
    groups.some((group) => group === null) ||
    typeof pageInfo.hasMore !== 'boolean' ||
    nextCursor === undefined ||
    totalRecords === null ||
    recordsThisMonth === null ||
    patientsWithHistory === null
  ) {
    return null
  }

  return {
    groups: groups as ClinicalRecordPatientGroup[],
    pageInfo: {
      hasMore: pageInfo.hasMore,
      nextCursor,
    },
    summary: {
      patientsWithHistory,
      recordsThisMonth,
      totalRecords,
    },
  }
}

function parseClinicalHistoryGroup(
  value: unknown,
): ClinicalRecordPatientGroup | null {
  const group = asRecord(value)

  if (
    !group ||
    typeof group.patientId !== 'string' ||
    typeof group.patientName !== 'string' ||
    typeof group.patientPhone !== 'string' ||
    !Array.isArray(group.records)
  ) {
    return null
  }

  const totalRecords = parseNonNegativeInteger(group.totalRecords)
  const records = group.records.map(parseGlobalClinicalRecordPayload)

  if (
    totalRecords === null ||
    totalRecords < 1 ||
    records.length < 1 ||
    records.some((record) => record === null)
  ) {
    return null
  }

  const parsedRecords = records as GlobalClinicalRecord[]

  return {
    hasPatient: true,
    latestRecord: parsedRecords[0],
    matchingRecords: parsedRecords,
    patientId: group.patientId,
    patientName: group.patientName,
    patientPhone: group.patientPhone,
    records: parsedRecords,
    totalRecords,
  }
}

function parseGlobalClinicalRecordPayload(
  value: unknown,
): GlobalClinicalRecord | null {
  const record = parseClinicalRecordPayload(value)

  if (!record) {
    return null
  }

  return {
    ...record,
    hasPatient: true,
    patientName: '',
    patientPhone: '',
  }
}

function parseClinicalRecordPayload(value: unknown): ClinicalRecord | null {
  const record = asRecord(value)

  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.patientId !== 'string' ||
    typeof record.date !== 'string' ||
    typeof record.reason !== 'string' ||
    typeof record.diagnosis !== 'string' ||
    typeof record.treatment !== 'string' ||
    typeof record.notes !== 'string'
  ) {
    return null
  }

  return {
    date: record.date.slice(0, 10),
    diagnosis: record.diagnosis,
    id: record.id,
    notes: record.notes,
    patientId: record.patientId,
    reason: record.reason,
    treatment: record.treatment,
  }
}

function parseClinicalRecordCursor(
  value: unknown,
): ClinicalRecordPageCursor | null | undefined {
  if (value === null) {
    return null
  }

  const cursor = asRecord(value)

  return cursor &&
    typeof cursor.id === 'string' &&
    typeof cursor.recordDate === 'string'
    ? { id: cursor.id, recordDate: cursor.recordDate }
    : undefined
}

function parseGlobalClinicalHistoryCursor(
  value: unknown,
): GlobalClinicalHistoryCursor | null | undefined {
  if (value === null) {
    return null
  }

  const cursor = asRecord(value)

  return cursor &&
    typeof cursor.latestRecordDate === 'string' &&
    typeof cursor.patientId === 'string'
    ? {
        latestRecordDate: cursor.latestRecordDate,
        patientId: cursor.patientId,
      }
    : undefined
}

function parseNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string'
}

function normalizeNullableDate(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 10) : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function getClinicalRecordsErrorMessage(error: unknown) {
  const typedError = error as { code?: string; message?: string } | null
  const code = typedError?.code

  if (code === '42501') {
    return 'No tienes permiso para acceder al historial clínico.'
  }

  if (code === '23503') {
    return 'No encontramos el paciente asociado al registro clínico.'
  }

  if (typedError?.message?.includes('PATIENT_NOT_FOUND')) {
    return 'No encontramos el paciente asociado al historial clínico.'
  }

  if (
    typedError?.message?.includes('INVALID_CLINICAL_HISTORY_PAGE_ARGUMENTS')
  ) {
    return 'No pudimos cargar esa página del historial clínico.'
  }

  return 'No pudimos guardar o cargar el historial clínico.'
}
