import type { Clinic, UserProfile } from '../types/database'

const demoTimestamp = '2026-01-01T00:00:00.000Z'

// Development/demo fallback only. It is used when Supabase env vars are absent.
export const demoClinic: Clinic = {
  country_code: '+591',
  created_at: demoTimestamp,
  id: 'demo-clinic',
  name: 'Consultorio Demo',
  phone: null,
  updated_at: demoTimestamp,
}

export const demoProfile: UserProfile = {
  clinic_id: demoClinic.id,
  created_at: demoTimestamp,
  email: null,
  full_name: 'Usuario Demo',
  id: 'demo-user',
  is_active: true,
  role: 'clinic_admin',
  updated_at: demoTimestamp,
}
