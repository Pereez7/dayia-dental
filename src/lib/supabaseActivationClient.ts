import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'
import { isAccountActivationRoute } from '../utils/accountActivation'
import { getActivationAuthOptions } from './supabaseAuthOptions'
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from './supabaseClient'

const canCreateActivationClient =
  isSupabaseConfigured &&
  typeof window !== 'undefined' &&
  isAccountActivationRoute()

export const supabaseActivation: SupabaseClient<Database> | null =
  canCreateActivationClient
    ? createClient<Database>(
        supabaseUrl as string,
        supabaseAnonKey as string,
        {
          auth: getActivationAuthOptions(window.sessionStorage),
        },
      )
    : null
