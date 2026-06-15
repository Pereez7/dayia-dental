import { supabase } from '../lib/supabaseClient'
import type { Clinic, UserProfile } from '../types/database'

export async function getCurrentClinicForProfile(profile: UserProfile | null) {
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured.'),
    }
  }

  if (!profile?.clinic_id) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', profile.clinic_id)
    .maybeSingle()

  return {
    data: data as Clinic | null,
    error,
  }
}
