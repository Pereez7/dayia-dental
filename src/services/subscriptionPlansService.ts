import { supabase } from '../lib/supabaseClient'
import type { PlanRecord } from '../types/database'
import type { PlatformClinicPlanId } from '../types/platform'

export interface SubscriptionPlanOption {
  currency: string
  founderMonthlyPrice: number | null
  id: PlatformClinicPlanId
  monthlyPrice: number | null
  name: string
}

const supportedPlanIds = new Set<PlatformClinicPlanId>([
  'basic',
  'medium',
  'pro',
])

export async function listSubscriptionPlans(): Promise<{
  data: SubscriptionPlanOption[]
  error: string | null
}> {
  if (!supabase) {
    return {
      data: [],
      error: 'Supabase no está configurado.',
    }
  }

  const { data, error } = await supabase
    .from('plans')
    .select(
      'id, name, currency, monthly_price, founder_monthly_price, is_active',
    )
    .eq('is_active', true)

  if (error) {
    return {
      data: [],
      error: 'No pudimos cargar los planes disponibles.',
    }
  }

  const plans = ((data ?? []) as Partial<PlanRecord>[])
    .filter(
      (
        plan,
      ): plan is Partial<PlanRecord> & { id: PlatformClinicPlanId } =>
        typeof plan.id === 'string' &&
        supportedPlanIds.has(plan.id as PlatformClinicPlanId),
    )
    .map((plan) => ({
      currency: plan.currency?.trim() || 'BOB',
      founderMonthlyPrice:
        plan.founder_monthly_price === null ||
        plan.founder_monthly_price === undefined
          ? null
          : Number(plan.founder_monthly_price),
      id: plan.id,
      monthlyPrice:
        plan.monthly_price === null || plan.monthly_price === undefined
          ? null
          : Number(plan.monthly_price),
      name: plan.name?.trim() || getPlanName(plan.id),
    }))
    .sort((left, right) => planRank(left.id) - planRank(right.id))

  return { data: plans, error: null }
}

function planRank(planId: PlatformClinicPlanId) {
  return { basic: 0, medium: 1, pro: 2 }[planId]
}

function getPlanName(planId: PlatformClinicPlanId) {
  return { basic: 'Basic', medium: 'Medium', pro: 'Pro' }[planId]
}
