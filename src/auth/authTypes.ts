import type { Session, User } from '@supabase/supabase-js'

import type { Clinic, UserProfile } from '../types/database'

export interface AuthState {
  authError: string
  currentClinic: Clinic | null
  isDemoMode: boolean
  isLoading: boolean
  profile: UserProfile | null
  session: Session | null
  user: User | null
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
}
