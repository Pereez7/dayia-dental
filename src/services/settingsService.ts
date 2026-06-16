import { supabase } from '../lib/supabaseClient'
import type {
  AppointmentInterval,
  BusinessDaySchedule,
  BusinessHoursSettings,
  CalendarException,
  CalendarExceptionFormValues,
  CalendarExceptionReason,
  CalendarExceptionType,
  Weekday,
} from '../types/BusinessHours'
import type {
  BusinessHourRecord,
  CalendarExceptionRecord,
  TreatmentRecord,
} from '../types/database'
import type { Treatment, TreatmentId } from '../types/Treatment'

export interface TreatmentInput {
  durationMinutes: number
  isActive: boolean
  name: string
}

export interface BusinessHoursResult {
  isConfigured: boolean
  settings: BusinessHoursSettings
}

type TreatmentInsert = Omit<TreatmentRecord, 'created_at' | 'id' | 'updated_at'>
type BusinessHourInsert = Omit<
  BusinessHourRecord,
  'created_at' | 'id' | 'updated_at'
>
type CalendarExceptionInsert = Omit<
  CalendarExceptionRecord,
  'created_at' | 'id' | 'updated_at'
>

const weekdayByNumber: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const weekdayNumberByName: Record<Weekday, number> = {
  friday: 5,
  monday: 1,
  saturday: 6,
  sunday: 0,
  thursday: 4,
  tuesday: 2,
  wednesday: 3,
}

const businessHoursDisplayOrder: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export function mapTreatmentRecordToTreatment(
  record: TreatmentRecord,
): Treatment {
  return {
    durationMinutes: record.duration_minutes,
    id: record.id,
    isActive: record.is_active,
    name: record.name,
  }
}

export function mapTreatmentInputToInsert(
  clinicId: string,
  input: TreatmentInput,
): TreatmentInsert {
  return {
    clinic_id: clinicId,
    duration_minutes: input.durationMinutes,
    is_active: input.isActive,
    name: input.name,
  }
}

export function mapBusinessHourRecordToSchedule(
  record: BusinessHourRecord,
): BusinessDaySchedule {
  return {
    day: weekdayByNumber[record.weekday] ?? 'monday',
    endTime: normalizeDbTime(record.end_time ?? ''),
    isOpen: record.is_open,
    startTime: normalizeDbTime(record.start_time ?? ''),
  }
}

export function mapBusinessHoursRecordsToSettings(
  records: BusinessHourRecord[],
): BusinessHoursResult {
  if (records.length === 0) {
    return {
      isConfigured: false,
      settings: getClosedBusinessHoursSettings(),
    }
  }

  const schedulesByDay = new Map(
    records.map((record) => [
      mapBusinessHourRecordToSchedule(record).day,
      mapBusinessHourRecordToSchedule(record),
    ]),
  )
  const firstInterval = records[0]?.slot_interval_minutes

  return {
    isConfigured: true,
    settings: {
      appointmentInterval: isAppointmentInterval(firstInterval)
        ? firstInterval
        : 30,
      weeklySchedule: businessHoursDisplayOrder.map(
        (day) =>
          schedulesByDay.get(day) ?? {
            day,
            endTime: '',
            isOpen: false,
            startTime: '',
          },
      ),
    },
  }
}

export function mapBusinessHoursSettingsToInserts(
  clinicId: string,
  settings: BusinessHoursSettings,
): BusinessHourInsert[] {
  return settings.weeklySchedule.map((daySchedule) => ({
    clinic_id: clinicId,
    end_time: daySchedule.isOpen ? daySchedule.endTime : null,
    is_open: daySchedule.isOpen,
    slot_interval_minutes: settings.appointmentInterval,
    start_time: daySchedule.isOpen ? daySchedule.startTime : null,
    weekday: weekdayNumberByName[daySchedule.day],
  }))
}

export function mapCalendarExceptionRecordToCalendarException(
  record: CalendarExceptionRecord,
): CalendarException {
  return {
    date: record.date,
    endTime: normalizeDbTime(record.end_time ?? '') || undefined,
    id: record.id,
    reason: (record.reason ?? undefined) as CalendarExceptionReason | undefined,
    reasonDetail: record.reason_detail ?? undefined,
    startTime: normalizeDbTime(record.start_time ?? '') || undefined,
    type: record.type as CalendarExceptionType,
  }
}

export function mapCalendarExceptionInputToInsert(
  clinicId: string,
  input: CalendarExceptionFormValues,
): CalendarExceptionInsert {
  return {
    clinic_id: clinicId,
    date: input.date,
    end_time: input.type === 'special-hours' ? input.endTime : null,
    reason: input.reason || null,
    reason_detail:
      input.reason === 'other' ? input.reasonDetail.trim() || null : null,
    start_time: input.type === 'special-hours' ? input.startTime : null,
    type: input.type,
  }
}

export async function getTreatmentsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('name', { ascending: true })

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapTreatmentRecordToTreatment(record as TreatmentRecord),
    ),
    error: null,
  }
}

export async function createTreatment(
  clinicId: string,
  treatmentInput: TreatmentInput,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('treatments')
    .insert([mapTreatmentInputToInsert(clinicId, treatmentInput)] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapTreatmentRecordToTreatment(data as TreatmentRecord),
    error: null,
  }
}

export async function updateTreatment(
  clinicId: string,
  treatmentId: TreatmentId,
  treatmentInput: TreatmentInput,
) {
  if (!supabase || typeof treatmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('treatments')
    .update({
      duration_minutes: treatmentInput.durationMinutes,
      is_active: treatmentInput.isActive,
      name: treatmentInput.name,
    } as never)
    .eq('clinic_id', clinicId)
    .eq('id', treatmentId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapTreatmentRecordToTreatment(data as TreatmentRecord),
    error: null,
  }
}

export async function setTreatmentActive(
  clinicId: string,
  treatmentId: TreatmentId,
  isActive: boolean,
) {
  if (!supabase || typeof treatmentId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('treatments')
    .update({ is_active: isActive } as never)
    .eq('clinic_id', clinicId)
    .eq('id', treatmentId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapTreatmentRecordToTreatment(data as TreatmentRecord),
    error: null,
  }
}

export async function getBusinessHoursByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('weekday', { ascending: true })

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapBusinessHoursRecordsToSettings(
      (data ?? []) as BusinessHourRecord[],
    ),
    error: null,
  }
}

export async function saveBusinessHours(
  clinicId: string,
  businessHours: BusinessHoursSettings,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('business_hours')
    .upsert(mapBusinessHoursSettingsToInserts(clinicId, businessHours) as never[], {
      onConflict: 'clinic_id,weekday',
    })
    .select('*')

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapBusinessHoursRecordsToSettings(
      (data ?? []) as BusinessHourRecord[],
    ).settings,
    error: null,
  }
}

export async function getCalendarExceptionsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('calendar_exceptions')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('date', { ascending: true })

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((record) =>
      mapCalendarExceptionRecordToCalendarException(
        record as CalendarExceptionRecord,
      ),
    ),
    error: null,
  }
}

export async function createCalendarException(
  clinicId: string,
  exceptionInput: CalendarExceptionFormValues,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('calendar_exceptions')
    .insert([
      mapCalendarExceptionInputToInsert(clinicId, exceptionInput),
    ] as never[])
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return {
    data: mapCalendarExceptionRecordToCalendarException(
      data as CalendarExceptionRecord,
    ),
    error: null,
  }
}

export async function deleteCalendarException(
  clinicId: string,
  exceptionId: CalendarException['id'],
) {
  if (!supabase || typeof exceptionId !== 'string') {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { error } = await supabase
    .from('calendar_exceptions')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('id', exceptionId)

  if (error) {
    return { data: null, error: getSettingsServiceErrorMessage() }
  }

  return { data: true, error: null }
}

export function getClosedBusinessHoursSettings(): BusinessHoursSettings {
  return {
    appointmentInterval: 30,
    weeklySchedule: businessHoursDisplayOrder.map((day) => ({
      day,
      endTime: '18:00',
      isOpen: false,
      startTime: '08:00',
    })),
  }
}

function isAppointmentInterval(value: number | undefined): value is AppointmentInterval {
  return value === 15 || value === 30 || value === 45 || value === 60
}

function normalizeDbTime(time: string) {
  return time.slice(0, 5)
}

function getSettingsServiceErrorMessage() {
  return 'No pudimos completar la operación de configuración.'
}
