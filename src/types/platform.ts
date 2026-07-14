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

export type PlatformClinicPlanId = 'basic' | 'medium' | 'pro'

export type PlatformClinicActivationStatus =
  | 'pending'
  | 'already_active'
  | 'not_sent'

export interface CreatePlatformClinicInput {
  clinicName: string
  ownerEmail: string
  ownerName: string
  planId: PlatformClinicPlanId
}

export interface CreatePlatformClinicResponse {
  activation: {
    activationUrl?: string
    status: PlatformClinicActivationStatus
  }
  clinic: {
    clinicId: string
    clinicName: string
    clinicStatus: 'pending_activation'
    ownerEmail: string | null
    ownerName: string | null
    planId: PlatformClinicPlanId
  }
}
