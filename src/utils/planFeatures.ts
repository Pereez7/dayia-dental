export type ClinicRole =
  | 'clinic_admin'
  | 'clinic_owner'
  | 'doctor'
  | 'receptionist'

export type MembershipStatus = 'active' | 'inactive' | 'pending'

export type PlanId = 'basic' | 'medium' | 'pro'

export type PlanFeatureKey =
  | 'advancedReports'
  | 'manageTeam'
  | 'whatsappAutomation'

export interface PlanFeatures {
  canManageTeam: boolean
  canUseAdvancedReports: boolean
  canUseWhatsappAutomation: boolean
  id: PlanId
  maxUsers: number
}

export const planFeaturesById: Record<PlanId, PlanFeatures> = {
  basic: {
    canManageTeam: false,
    canUseAdvancedReports: false,
    canUseWhatsappAutomation: false,
    id: 'basic',
    maxUsers: 1,
  },
  medium: {
    canManageTeam: true,
    canUseAdvancedReports: false,
    canUseWhatsappAutomation: false,
    id: 'medium',
    maxUsers: 4,
  },
  pro: {
    canManageTeam: true,
    canUseAdvancedReports: true,
    canUseWhatsappAutomation: true,
    id: 'pro',
    maxUsers: 10,
  },
}

const clinicRoleLabels: Record<ClinicRole, string> = {
  clinic_admin: 'Administrador del consultorio',
  clinic_owner: 'Propietario del consultorio',
  doctor: 'Doctor',
  receptionist: 'Recepción',
}

export function getPlanFeatures(planId: PlanId | string | null | undefined) {
  if (planId === 'medium' || planId === 'pro') {
    return planFeaturesById[planId]
  }

  return planFeaturesById.basic
}

export function canAccessFeature(
  features: PlanFeatures,
  featureKey: PlanFeatureKey,
) {
  if (featureKey === 'manageTeam') {
    return features.canManageTeam
  }

  if (featureKey === 'whatsappAutomation') {
    return features.canUseWhatsappAutomation
  }

  return features.canUseAdvancedReports
}

export function canManageTeam(
  role: ClinicRole | string | null | undefined,
  plan: PlanFeatures | PlanId,
) {
  const features = typeof plan === 'string' ? getPlanFeatures(plan) : plan

  return (
    features.canManageTeam &&
    (role === 'clinic_owner' || role === 'clinic_admin')
  )
}

export function isWithinUserLimit(currentUsers: number, plan: PlanFeatures) {
  return currentUsers < plan.maxUsers
}

export function getVisibleClinicRoleLabel(
  role: ClinicRole | string | null | undefined,
) {
  if (role === 'clinic_owner' || role === 'owner') {
    return clinicRoleLabels.clinic_owner
  }

  if (role === 'doctor') {
    return clinicRoleLabels.doctor
  }

  if (role === 'receptionist' || role === 'reception') {
    return clinicRoleLabels.receptionist
  }

  if (role === 'platform_admin' || role === 'super_admin') {
    return clinicRoleLabels.clinic_admin
  }

  return clinicRoleLabels.clinic_admin
}
