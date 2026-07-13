export type PlatformClinicStatus =
  | 'active'
  | 'pending_activation'
  | 'suspended'
  | 'unknown'

export type PlatformSubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'unknown'

export interface PlatformClinicSummary {
  activeMembersCount: number
  clinicId: string
  clinicName: string
  clinicStatus: PlatformClinicStatus | null
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
