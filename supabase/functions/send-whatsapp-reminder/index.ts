import {
  buildReminderDelivery,
  jsonResponse,
} from '../_shared/whatsapp.ts'

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const body = await request.json().catch(() => null)
  const reminderId = body?.reminderId

  if (!reminderId || typeof reminderId !== 'string') {
    return jsonResponse({ error: 'reminderId is required.' }, 400)
  }

  const delivery = await buildReminderDelivery(reminderId)

  if ('error' in delivery) {
    return jsonResponse({ error: delivery.error }, delivery.status)
  }

  if (delivery.result.dryRun) {
    return jsonResponse({
      mode: 'dry-run',
      result: delivery.result,
    })
  }

  // Future production send:
  // POST https://graph.facebook.com/vXX.X/{phone_number_id}/messages
  // Authorization: Bearer Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  // Keep real sending disabled unless WHATSAPP_SEND_ENABLED=true.
  return jsonResponse({
    mode: 'prepared',
    result: delivery.result,
  })
})
