import { useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import { normalizeUserRole } from '../auth/permissions'

const compactRoleLabels = {
  clinic_admin: 'Administrador',
  doctor: 'Doctor',
  receptionist: 'Recepción',
  super_admin: 'Super administrador',
} as const

export function SessionSummary() {
  const {
    currentClinic,
    isDemoMode,
    isSessionContextLoading,
    profile,
    signOut,
  } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const isRealSessionLoading =
    !isDemoMode && (isSessionContextLoading || !profile || !currentClinic)
  const userName =
    profile?.full_name?.trim() || (isDemoMode ? 'Usuario demo' : 'Usuario')
  const roleLabel = isDemoMode
    ? 'Modo demo'
    : profile?.role
      ? compactRoleLabels[normalizeUserRole(profile.role)]
      : 'Rol no definido'
  const clinicName = currentClinic?.name || 'Consultorio'

  async function handleSignOut() {
    setIsSigningOut(true)
    await signOut()
    setIsSigningOut(false)
  }

  if (isRealSessionLoading) {
    return (
      <section
        className="session-card session-card--loading"
        aria-label="Sesion actual"
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
    <section className="session-card" aria-label="Sesion actual">
      <div className="session-identity">
        <strong>{userName}</strong>
      </div>
      <div className="session-meta-row">
        <div className="session-details">
          <span>{roleLabel}</span>
          <span aria-hidden="true">·</span>
          <small>{clinicName}</small>
        </div>
        <button
          className="session-signout"
          disabled={isSigningOut}
          onClick={handleSignOut}
          type="button"
        >
          {isSigningOut ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </section>
  )
}
