import { supabase } from '../lib/supabaseClient'
import type {
  Clinic,
  ClinicMembershipRecord,
  ClinicSubscriptionRecord,
  PlanRecord,
  UserProfile,
} from '../types/database'

export interface ClinicSessionContext {
  activeMembership: ClinicMembershipRecord | null
  currentClinic: Clinic | null
  currentPlanId: string | null
  currentPlanCurrency: string
  currentPlanMonthlyPrice: number | null
  currentSubscription: ClinicSubscriptionRecord | null
  profile: UserProfile
}

export async function getClinicSessionContext(profile: UserProfile) {
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured.'),
    }
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('clinic_memberships')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (membershipsError) {
    return { data: null, error: membershipsError }
  }

  const activeMembership = selectActiveClinicMembership(
    (memberships ?? []) as ClinicMembershipRecord[],
  )
  const resolvedProfile = resolveProfileFromMembership(profile, activeMembership)
  const clinicId = resolvedProfile.clinic_id

  if (!clinicId) {
    return {
      data: {
        activeMembership,
        currentClinic: null,
        currentPlanId: null,
        currentPlanCurrency: 'BOB',
        currentPlanMonthlyPrice: null,
        currentSubscription: null,
        profile: resolvedProfile,
      } satisfies ClinicSessionContext,
      error: null,
    }
  }

  const [clinicResult, subscriptionResult] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', clinicId).maybeSingle(),
    supabase
      .from('clinic_subscriptions')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
  ])

  if (clinicResult.error || subscriptionResult.error) {
    return {
      data: null,
      error: clinicResult.error ?? subscriptionResult.error,
    }
  }

  const subscription = subscriptionResult.data as ClinicSubscriptionRecord | null
  const planId = getSubscriptionPlanId(subscription)
  const planResult = planId
    ? await supabase
        .from('plans')
        .select('monthly_price, currency')
        .eq('id', planId)
        .maybeSingle()
    : { data: null, error: null }

  if (planResult.error) {
    return { data: null, error: planResult.error }
  }
  const plan = planResult.data as Pick<
    PlanRecord,
    'currency' | 'monthly_price'
  > | null

  return {
    data: {
      activeMembership,
      currentClinic: clinicResult.data as Clinic | null,
      currentPlanCurrency: plan?.currency?.trim() || 'BOB',
      currentPlanId: planId,
      currentPlanMonthlyPrice:
        plan?.monthly_price === null ||
        plan?.monthly_price === undefined
          ? null
          : Number(plan.monthly_price),
      currentSubscription: subscription,
      profile: resolvedProfile,
    } satisfies ClinicSessionContext,
    error: null,
  }
}

export function selectActiveClinicMembership(
  memberships: ClinicMembershipRecord[],
) {
  return (
    memberships
      .filter((membership) => membership.status === 'active')
      .sort((left, right) => {
        const activationOrder =
          getTimestamp(right.activated_at) - getTimestamp(left.activated_at)

        if (activationOrder !== 0) {
          return activationOrder
        }

        const creationOrder =
          getTimestamp(right.created_at) - getTimestamp(left.created_at)

        if (creationOrder !== 0) {
          return creationOrder
        }

        return left.id.localeCompare(right.id)
      })[0] ?? null
  )
}

export function resolveProfileFromMembership(
  profile: UserProfile,
  membership: ClinicMembershipRecord | null,
) {
  if (!membership) {
    return profile
  }

  return {
    ...profile,
    clinic_id: membership.clinic_id,
    role: membership.role,
  }
}

export function getSubscriptionPlanId(
  subscription: Pick<ClinicSubscriptionRecord, 'plan_id'> | null,
) {
  return subscription?.plan_id?.trim() || null
}

function getTimestamp(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}
