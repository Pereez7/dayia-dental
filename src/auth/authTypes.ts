import type { Session, User } from '@supabase/supabase-js'

import type {
  Clinic,
  ClinicMembershipRecord,
  ClinicSubscriptionRecord,
  UserProfile,
} from '../types/database'

export interface AuthState {
  activeMembership: ClinicMembershipRecord | null
  authError: string
  currentClinic: Clinic | null
  currentPlanId: string | null
  currentPlanCurrency: string
  currentPlanMonthlyPrice: number | null
  currentSubscription: ClinicSubscriptionRecord | null
  isDemoMode: boolean
  isLoading: boolean
  isSessionContextLoading: boolean
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
