import { supabase } from '../lib/supabaseClient'

export async function getClinicSettings() {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  // Future migration: read treatments, business hours, and calendar exceptions.
  return { data: null, error: 'Settings service is not connected yet.' }
}
