import { supabase } from '../lib/supabaseClient'
import type {
  Clinic,
  ClinicMembershipRecord,
  ClinicSubscriptionRecord,
  UserProfile,
} from '../types/database'

export interface ClinicSessionContext {
  activeMembership: ClinicMembershipRecord | null
  currentClinic: Clinic | null
  currentPlanId: string | null
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

  return {
    data: {
      activeMembership,
      currentClinic: clinicResult.data as Clinic | null,
      currentPlanId: getSubscriptionPlanId(
        subscriptionResult.data as ClinicSubscriptionRecord | null,
      ),
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
