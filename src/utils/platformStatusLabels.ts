import type {
  PlatformClinicStatus,
  PlatformSubscriptionStatus,
} from '../types/platform'

const clinicStatusLabels: Record<PlatformClinicStatus, string> = {
  active: 'Activa',
  pending_activation: 'Pendiente',
  suspended: 'Suspendida',
  unknown: 'Estado no definido',
}

const subscriptionStatusLabels: Record<
  PlatformSubscriptionStatus,
  string
> = {
  active: 'Activa',
  blocked: 'Bloqueada',
  canceled: 'Cancelada',
  lifetime: 'Vitalicia',
  past_due: 'Pago pendiente',
  trialing: 'En prueba',
  unknown: 'Sin estado',
}

export function getPlatformClinicStatusLabel(
  status: PlatformClinicStatus | null,
) {
  return clinicStatusLabels[status ?? 'unknown']
}

export function getPlatformSubscriptionStatusLabel(
  status: PlatformSubscriptionStatus | null,
) {
  return subscriptionStatusLabels[status ?? 'unknown']
}
