import { supabase } from '../lib/supabaseClient'
import type {
  OdontogramEntry,
  SaveOdontogramEntryInput,
  ToothCode,
  ToothStatus,
  ToothSurface,
} from '../types/Odontogram'
import type { OdontogramEntryRecord } from '../types/database'
import type { PatientId } from '../types/Patient'
import { normalizeOdontogramNotes } from '../utils/odontogram'

const odontogramColumns = [
  'id',
  'clinic_id',
  'patient_id',
  'tooth_code',
  'surface',
  'status',
  'notes',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
].join(', ')

export async function listOdontogramEntries(
  clinicId: string,
  patientId: PatientId,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('odontogram_entries')
    .select(odontogramColumns)
    .eq('clinic_id', clinicId)
    .eq('patient_id', String(patientId))
    .order('tooth_code', { ascending: true })

  if (error) {
    return { data: null, error: getOdontogramErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((record) =>
      mapOdontogramRecord(record as unknown as OdontogramEntryRecord),
    ),
    error: null,
  }
}

export async function saveOdontogramEntry(
  input: SaveOdontogramEntryInput,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('odontogram_entries')
    .upsert(mapSaveOdontogramInputToRecord(input) as never, {
      onConflict: 'clinic_id,patient_id,tooth_code,surface',
    })
    .select(odontogramColumns)
    .single()

  if (error || !data) {
    return { data: null, error: getOdontogramErrorMessage(error) }
  }

  return {
    data: mapOdontogramRecord(data as unknown as OdontogramEntryRecord),
    error: null,
  }
}

export function mapOdontogramRecord(
  record: OdontogramEntryRecord,
): OdontogramEntry {
  return {
    id: record.id,
    notes: record.notes?.trim() || '',
    patientId: record.patient_id,
    status: record.status as ToothStatus,
    surface: record.surface as ToothSurface | null,
    toothCode: record.tooth_code as ToothCode,
    updatedAt: record.updated_at,
  }
}

export function mapSaveOdontogramInputToRecord(
  input: SaveOdontogramEntryInput,
) {
  return {
    clinic_id: input.clinicId,
    notes: normalizeOdontogramNotes(input.notes) || null,
    patient_id: String(input.patientId),
    status: input.status,
    surface: input.surface,
    tooth_code: input.toothCode,
  }
}

export function getOdontogramErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code

  if (code === '42501') {
    return 'No tienes permiso para acceder al odontograma.'
  }

  if (code === '23503') {
    return 'No encontramos el paciente asociado al odontograma.'
  }

  if (code === '23505') {
    return 'No pudimos actualizar la pieza porque ya existe un registro incompatible.'
  }

  return 'No pudimos guardar o cargar el odontograma.'
}
