import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ReminderStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'scheduled'
  | 'sent'
  | 'skipped'

export interface ReminderRecord {
  appointment_id: string
  channel: 'whatsapp'
  clinic_id: string
  id: string
  message: string
  patient_id: string
  scheduled_at: string
  status: ReminderStatus
}

export interface SendReminderResult {
  dryRun: boolean
  phoneNumberId: string
  reminderId: string
  to: string
  wouldSend: {
    message: string
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    status,
  })
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase Edge Function secrets.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}

export function normalizeWhatsAppPhone(phone: string | null) {
  return (phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '')
}

export async function buildReminderDelivery(reminderId: string) {
  const supabase = createAdminClient()

  const { data: reminder, error: reminderError } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', reminderId)
    .single()

  if (reminderError || !reminder) {
    return { error: 'Reminder not found.', status: 404 }
  }

  if (!['pending', 'scheduled'].includes(reminder.status)) {
    return { error: 'Reminder is not pending or scheduled.', status: 409 }
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id, phone')
    .eq('clinic_id', reminder.clinic_id)
    .eq('id', reminder.patient_id)
    .single()

  const to = normalizeWhatsAppPhone(patient?.phone ?? null)

  if (!to) {
    await supabase
      .from('reminders')
      .update({ status: 'skipped', metadata: { reason: 'missing_phone' } })
      .eq('clinic_id', reminder.clinic_id)
      .eq('id', reminder.id)

    return { error: 'Patient phone is missing.', status: 422 }
  }

  const { data: whatsappSettings } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('clinic_id', reminder.clinic_id)
    .single()

  if (!whatsappSettings?.is_connected || !whatsappSettings.phone_number_id) {
    return { error: 'WhatsApp is not configured for this clinic.', status: 422 }
  }

  const result: SendReminderResult = {
    dryRun: Deno.env.get('WHATSAPP_SEND_ENABLED') !== 'true',
    phoneNumberId: whatsappSettings.phone_number_id,
    reminderId: reminder.id,
    to,
    wouldSend: {
      message: reminder.message,
    },
  }

  return { result, status: 200 }
}
