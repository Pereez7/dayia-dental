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

export type PlatformOwnerMembershipStatus =
  | 'active'
  | 'pending_activation'

export interface PlatformClinicListItem {
  activeMembersCount: number
  clinicId: string
  clinicName: string
  clinicStatus: PlatformClinicStatus | null
  createdAt: string
  ownerEmail: string | null
  ownerInvitationSentAt: string | null
  ownerMembershipStatus: PlatformOwnerMembershipStatus | null
  ownerName: string | null
  pendingPaymentSubmissionsCount: number
  planId: string | null
  planName: string | null
  subscriptionStatus: PlatformSubscriptionStatus | null
}

export interface PlatformClinicSummary extends PlatformClinicListItem {
  blockedAt: string | null
  currency: string
  currentPeriodEndsAt: string | null
  customMonthlyPrice: number | null
  founderMonthlyPrice: number | null
  founderPriceLocked: boolean
  graceEndsAt: string | null
  isLifetime: boolean
  lastPaymentAt: string | null
  latestRegisteredPaymentId: string | null
  monthlyPrice: number | null
  paymentStatus: string | null
  payments: PlatformSubscriptionPayment[]
  paymentSubmissions: PlatformPaymentSubmission[]
  planFounderMonthlyPrices: Partial<Record<PlatformClinicPlanId, number | null>>
  planMonthlyPrices: Partial<Record<PlatformClinicPlanId, number | null>>
  priceTier: import('../utils/subscriptionBilling').PriceTier
  registeredLifetimePayment: PlatformSubscriptionPayment | null
  scheduledPlanId: PlatformClinicPlanId | null
  scheduledPlanStartsAt: string | null
  trialEndsAt: string | null
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
  effectiveAt?: string | null
  id: string
  notes: string | null
  paymentType?:
    | 'regular'
    | 'upgrade_proration'
    | 'reactivation_plan_change'
  planId: string
  previousPlanId?: string | null
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

export interface RejectPaymentSubmissionInput {
  reason: string
  submissionId: string
}

export interface UpdateClinicSubscriptionInput {
  action:
    | 'block'
    | 'cancel'
    | 'change_plan'
    | 'grant_extra_days'
    | 'enable_lifetime'
    | 'disable_lifetime'
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
  clinics: PlatformClinicListItem[]
  pageInfo: PlatformPageInfo<PlatformClinicCursor>
}

export interface PlatformClinicCursor {
  createdAt: string
  id: string
}

export interface PlatformPaymentCursor extends PlatformClinicCursor {
  paidAt: string
}

export type PlatformSubmissionCursor = PlatformClinicCursor

export interface PlatformPageInfo<Cursor> {
  hasNextPage: boolean
  limit: number
  nextCursor: Cursor | null
  totalCount: number
}

export interface ListPlatformClinicsInput {
  cursor?: PlatformClinicCursor | null
  limit?: number
}

export interface GetPlatformClinicBillingInput {
  clinicId: string
  paymentCursor?: PlatformPaymentCursor | null
  paymentLimit?: number
  submissionCursor?: PlatformSubmissionCursor | null
  submissionLimit?: number
}

export interface GetPlatformClinicBillingResponse {
  clinic: PlatformClinicSummary
  paymentPageInfo: PlatformPageInfo<PlatformPaymentCursor>
  submissionPageInfo: PlatformPageInfo<PlatformSubmissionCursor>
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
    clinicStatus: 'active' | 'pending_activation'
    ownerEmail: string | null
    ownerName: string | null
    planId: PlatformClinicPlanId
    priceTier: CreatePlatformClinicInput['priceTier']
  }
}

export interface ResendPlatformClinicInvitationInput {
  clinicId: string
}

export interface ResendPlatformClinicInvitationResponse {
  email: string
  sentAt: string
}

export interface CorrectPlatformClinicOwnerEmailInput {
  clinicId: string
  ownerEmail: string
}

export type CorrectPlatformClinicOwnerEmailResponse =
  ResendPlatformClinicInvitationResponse
