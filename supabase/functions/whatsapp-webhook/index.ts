import { createAdminClient, jsonResponse } from '../_shared/whatsapp.ts'

Deno.serve(async (request) => {
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expectedToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

    if (mode === 'subscribe' && token && token === expectedToken) {
      return new Response(challenge ?? '', { status: 200 })
    }

    return jsonResponse({ error: 'Webhook verification failed.' }, 403)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const payload = await request.json().catch(() => null)
  const supabase = createAdminClient()

  // Future phase:
  // Parse WhatsApp statuses, match provider_message_id and update reminders:
  // sent, delivered_at, read_at, failed_reason and metadata.
  await supabase.from('reminders').select('id').limit(1)

  return jsonResponse({
    received: Boolean(payload),
    status: 'webhook-placeholder',
  })
})
