import { supabase } from '../lib/supabaseClient'

export async function listPatientsForClinic() {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  // Future migration: read patients scoped by the authenticated user's clinic.
  return { data: null, error: 'Patients service is not connected yet.' }
}
