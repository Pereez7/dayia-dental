import { supabase } from '../lib/supabaseClient'
import type { WhatsAppSettingsRecord } from '../types/database'
import type {
  WhatsappConnectionStatus,
  WhatsappSettings,
  WhatsappSettingsFormValues,
} from '../types/WhatsApp'

type WhatsappSettingsInsert = Omit<
  WhatsAppSettingsRecord,
  'created_at' | 'id' | 'updated_at'
>

export function mapWhatsappSettingsRecordToSettings(
  record: WhatsAppSettingsRecord,
): WhatsappSettings {
  return {
    businessAccountId: record.business_account_id ?? '',
    id: record.id,
    isConnected: record.is_connected,
    phoneNumber: record.phone_number ?? '',
    phoneNumberId: record.phone_number_id ?? '',
    provider: 'whatsapp_cloud_api',
  }
}

export function mapWhatsappSettingsInputToInsert(
  clinicId: string,
  input: WhatsappSettingsFormValues,
): WhatsappSettingsInsert {
  return {
    business_account_id: input.businessAccountId.trim() || null,
    clinic_id: clinicId,
    is_connected: input.isConnected,
    phone_number: input.phoneNumber.trim() || null,
    phone_number_id: input.phoneNumberId.trim() || null,
    provider: input.provider,
  }
}

export function getWhatsappConnectionStatus(
  settings: WhatsappSettings | null,
): WhatsappConnectionStatus {
  if (!settings) {
    return 'not-configured'
  }

  if (settings.isConnected) {
    return 'connected'
  }

  if (
    settings.phoneNumber ||
    settings.phoneNumberId ||
    settings.businessAccountId
  ) {
    return 'pending'
  }

  return 'not-configured'
}

export async function getWhatsappSettingsByClinic(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (error) {
    return { data: null, error: getWhatsappSettingsServiceErrorMessage() }
  }

  return {
    data: data
      ? mapWhatsappSettingsRecordToSettings(data as WhatsAppSettingsRecord)
      : null,
    error: null,
  }
}

export async function upsertWhatsappSettings(
  clinicId: string,
  input: WhatsappSettingsFormValues,
) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('whatsapp_settings')
    .upsert(mapWhatsappSettingsInputToInsert(clinicId, input) as never, {
      onConflict: 'clinic_id',
    })
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getWhatsappSettingsServiceErrorMessage() }
  }

  return {
    data: mapWhatsappSettingsRecordToSettings(data as WhatsAppSettingsRecord),
    error: null,
  }
}

function getWhatsappSettingsServiceErrorMessage() {
  return 'No pudimos completar la operación de WhatsApp.'
}
