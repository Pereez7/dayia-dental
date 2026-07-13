import type { PlanId } from '../utils/planFeatures'

export interface ClinicOnboardingFormValues {
  clinicName: string
  initialPlan: PlanId
  ownerEmail: string
  ownerName: string
}

export type ClinicOnboardingFormErrors = Partial<
  Record<keyof ClinicOnboardingFormValues, string>
>
