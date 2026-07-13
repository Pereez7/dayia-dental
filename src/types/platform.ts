export type PlatformClinicStatus = 'active' | 'inactive' | 'unknown'

export type PlatformSubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'suspended'
  | 'trial'
  | 'unknown'

export interface PlatformClinicSummary {
  activeMembersCount: number
  clinicId: string
  clinicName: string
  clinicStatus: PlatformClinicStatus
  createdAt: string
  ownerEmail: string | null
  ownerName: string | null
  planId: string | null
  planName: string | null
  subscriptionStatus: PlatformSubscriptionStatus | null
}

export interface ListPlatformClinicsResponse {
  clinics: PlatformClinicSummary[]
}
