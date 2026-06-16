import {
  buildReminderDelivery,
  createAdminClient,
  jsonResponse,
} from '../_shared/whatsapp.ts'

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabase = createAdminClient()
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('channel', 'whatsapp')
    .in('status', ['pending', 'scheduled'])
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(25)

  if (error) {
    return jsonResponse({ error: 'Could not load due reminders.' }, 500)
  }

  const results = []

  for (const reminder of reminders ?? []) {
    results.push(await buildReminderDelivery(reminder.id))
  }

  return jsonResponse({
    dryRun: Deno.env.get('WHATSAPP_SEND_ENABLED') !== 'true',
    processed: results.length,
    results,
  })
})
