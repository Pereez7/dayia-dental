import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'
import { getMainAuthOptions } from './supabaseAuthOptions'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: getMainAuthOptions(
        typeof window === 'undefined' ? '/' : window.location.pathname,
      ),
    })
  : null
