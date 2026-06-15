import { supabase } from '../lib/supabaseClient'

export async function listRemindersForClinic() {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  // Future migration: read reminder queue generated for appointments by clinic.
  return { data: null, error: 'Reminders service is not connected yet.' }
}
