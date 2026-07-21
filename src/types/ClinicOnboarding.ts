import type { PlanId } from '../utils/planFeatures'

export type ClinicOnboardingPriceTier = 'standard' | 'founder'

export interface ClinicOnboardingFormValues {
  clinicName: string
  initialPlan: PlanId
  initialPriceTier: ClinicOnboardingPriceTier
  ownerEmail: string
  ownerName: string
}

export type ClinicOnboardingFormErrors = Partial<
  Record<keyof ClinicOnboardingFormValues, string>
>
