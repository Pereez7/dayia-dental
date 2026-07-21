export type PlatformClinicStatus =
  | 'active'
  | 'pending_activation'
  | 'suspended'
  | 'unknown'

export type PlatformSubscriptionStatus =
  | 'active'
  | 'blocked'
  | 'canceled'
  | 'lifetime'
  | 'past_due'
  | 'trialing'
  | 'unknown'

export interface PlatformClinicSummary {
  activeMembersCount: number
  blockedAt: string | null
  clinicId: string
  clinicName: string
  clinicStatus: PlatformClinicStatus | null
  createdAt: string
  currency: string
  currentPeriodEndsAt: string | null
  graceEndsAt: string | null
  isLifetime: boolean
  lastPaymentAt: string | null
  monthlyPrice: number | null
  founderMonthlyPrice: number | null
  planMonthlyPrices: Partial<Record<PlatformClinicPlanId, number | null>>
  planFounderMonthlyPrices: Partial<Record<PlatformClinicPlanId, number | null>>
  priceTier: import('../utils/subscriptionBilling').PriceTier
  customMonthlyPrice: number | null
  founderPriceLocked: boolean
  scheduledPlanId: PlatformClinicPlanId | null
  scheduledPlanStartsAt: string | null
  ownerEmail: string | null
  ownerName: string | null
  planId: string | null
  planName: string | null
  subscriptionStatus: PlatformSubscriptionStatus | null
  trialEndsAt: string | null
  paymentStatus: string | null
  payments: PlatformSubscriptionPayment[]
  paymentSubmissions: PlatformPaymentSubmission[]
}

export interface PlatformSubscriptionPayment {
  amountDue: number
  amountPaid: number
  billingCycle: string
  createdAt: string
  currency: string
  customDays: number | null
  discountAmount: number
  discountPercent: number
  id: string
  monthsCovered: number | null
  notes: string | null
  paidAt: string
  periodEndsAt: string | null
  periodStartsAt: string | null
  planId: string
  paymentType: import('../utils/subscriptionBilling').PaymentType
  priceTier: import('../utils/subscriptionBilling').PriceTier
  previousPlanId: string | null
  newPlanId: string | null
  recordedBy: string | null
  reference: string | null
  status: 'registered' | 'voided'
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
}

export interface PlatformPaymentSubmission {
  amountExpected: number
  billingCycle: 'annual' | 'monthly' | 'six_months'
  createdAt: string
  currency: string
  id: string
  notes: string | null
  planId: string
  reference: string
  status: 'approved' | 'cancelled' | 'pending_review' | 'rejected'
  submittedBy: string | null
}

export interface RegisterSubscriptionPaymentInput {
  amountPaid: number
  billingCycle: import('../utils/subscriptionBilling').BillingCycle
  clinicId: string
  customDays: number | null
  discountPercent: number
  isLifetime: boolean
  notes: string
  paidAt: string
  planId: PlatformClinicPlanId
  paymentType?: import('../utils/subscriptionBilling').PaymentType
  reference: string
  submissionId?: string
}

export interface VoidSubscriptionPaymentInput {
  paymentId: string
  reason: string
}

export interface UpdateClinicSubscriptionInput {
  action:
    | 'block'
    | 'cancel'
    | 'change_plan'
    | 'grant_extra_days'
    | 'mark_lifetime'
    | 'reactivate'
    | 'set_custom_price'
    | 'set_founder_price'
    | 'set_standard_price'
    | 'force_change_plan'
  clinicId: string
  days?: number
  customMonthlyPrice?: number
  notes?: string
  planId?: PlatformClinicPlanId
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
  priceTier: 'standard' | 'founder'
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
    priceTier: CreatePlatformClinicInput['priceTier']
  }
}
