import { useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import { canAccessPlatformAdministration } from '../auth/permissions'
import { normalizePersonName } from '../utils/textNormalizers'
import { getSessionPlanLabel, getSessionRoleLabel } from './sessionRole'

interface SessionSummaryProps {
  canAccessSubscription: boolean
  isSubscriptionActive: boolean
  onOpenSubscription: () => void
}

export function SessionSummary({
  canAccessSubscription,
  isSubscriptionActive,
  onOpenSubscription,
}: SessionSummaryProps) {
  const {
    currentClinic,
    currentPlanId,
    isDemoMode,
    isSessionContextLoading,
    profile,
    signOut,
  } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const isPlatformAdministration =
    canAccessPlatformAdministration(profile)

  const hasResolvedSessionIdentity =
    Boolean(profile) && Boolean(currentClinic || isPlatformAdministration)
  const isRealSessionLoading =
    !isDemoMode && isSessionContextLoading && !hasResolvedSessionIdentity
  const userName =
    (profile?.full_name ? normalizePersonName(profile.full_name) : '') ||
    (isDemoMode ? 'Usuario demo' : 'Usuario')
  const roleLabel = getSessionRoleLabel({
    isDemoMode,
    isPlatformAdministration,
    role: profile?.role,
  })
  const planLabel = getSessionPlanLabel({
    planId: currentPlanId,
    role: profile?.role,
  })
  const clinicName = isPlatformAdministration
    ? 'Plataforma DayIA'
    : currentClinic?.name || 'Consultorio'

  async function handleSignOut() {
    setIsSigningOut(true)
    await signOut()
    setIsSigningOut(false)
  }

  if (isRealSessionLoading) {
    return (
      <section
        className="session-card session-card--loading"
        aria-label="Sesión actual"
        aria-busy="true"
      >
        <div className="session-identity">
          <strong>Cargando sesión...</strong>
        </div>
        <div className="session-meta-row">
          <div className="session-details">
            <span>Preparando consultorio</span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="session-card" aria-label="Sesión actual">
      <div className="session-identity">
        <strong>{userName}</strong>
      </div>
      <div className="session-meta-row">
        <div className="session-details">
          <span>{roleLabel}</span>
          <span
            aria-hidden="true"
            className="session-mobile-separator"
          >
            ·
          </span>
          {planLabel && (
            <>
              <span>{planLabel}</span>
              <span
                aria-hidden="true"
                className="session-mobile-separator"
              >
                ·
              </span>
            </>
          )}
          <small>{clinicName}</small>
        </div>
        <div
          className={`session-actions${
            canAccessSubscription ? ' session-actions--with-subscription' : ''
          }`}
        >
          {canAccessSubscription && (
            <button
              aria-current={isSubscriptionActive ? 'page' : undefined}
              aria-label="Abrir suscripción, plan y pagos"
              className="session-subscription-action"
              onClick={onOpenSubscription}
              type="button"
            >
              Suscripción
            </button>
          )}
          <button
            className="session-signout"
            disabled={isSigningOut}
            onClick={handleSignOut}
            type="button"
          >
            {isSigningOut ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </section>
  )
}
