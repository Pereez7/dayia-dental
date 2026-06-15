import { supabase } from '../lib/supabaseClient'

export async function listAppointmentsForClinic() {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  // Future migration: read appointments, change logs, and availability by clinic.
  return { data: null, error: 'Appointments service is not connected yet.' }
}
