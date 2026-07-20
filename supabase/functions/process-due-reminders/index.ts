import {
  buildReminderDelivery,
  createAdminClient,
  jsonResponse,
} from '../_shared/whatsapp.ts'
import { resolveReminderDisposition } from '../_shared/reminderExpiration.ts'

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabase = createAdminClient()
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select(`
      id,
      clinic_id,
      appointment:appointments!inner (
        appointment_date,
        start_time,
        status
      )
    `)
    .eq('channel', 'whatsapp')
    .in('status', ['pending', 'scheduled'])
    .neq('reminder_type', 'immediate')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(25)

  if (error) {
    return jsonResponse({ error: 'Could not load due reminders.' }, 500)
  }

  const results = []
  const referenceDate = new Date()

  for (const reminder of reminders ?? []) {
    const appointment = Array.isArray(reminder.appointment)
      ? reminder.appointment[0]
      : reminder.appointment
    const disposition = resolveReminderDisposition(
      {
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.start_time,
        status: appointment.status,
      },
      referenceDate,
    )

    if (disposition !== 'processable') {
      const status = disposition === 'cancelled' ? 'cancelled' : 'skipped'
      const metadata =
        disposition === 'cancelled'
          ? { reason: 'appointment_cancelled' }
          : {
              appointment_date: appointment.appointment_date,
              appointment_status: appointment.status,
              appointment_time: appointment.start_time,
              note: 'La cita ya pasó sin envío del recordatorio.',
              reason: 'appointment_passed',
            }
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ metadata, status })
        .eq('clinic_id', reminder.clinic_id)
        .eq('id', reminder.id)
        .in('status', ['pending', 'scheduled'])

      results.push({
        reminderId: reminder.id,
        status: updateError ? 'update_failed' : status,
      })
      continue
    }

    results.push(await buildReminderDelivery(reminder.id))
  }

  return jsonResponse({
    dryRun: Deno.env.get('WHATSAPP_SEND_ENABLED') !== 'true',
    processed: results.length,
    results,
  })
})
