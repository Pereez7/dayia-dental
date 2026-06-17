import { useState } from 'react'

import { useAuth } from '../auth/AuthContext'
import { getUserRoleLabel } from '../auth/permissions'

export function SessionSummary() {
  const { currentClinic, isDemoMode, profile, signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const userName =
    profile?.full_name?.trim() || user?.email || (isDemoMode ? 'Usuario demo' : 'Usuario')
  const roleLabel = isDemoMode ? 'Modo demo' : getUserRoleLabel(profile?.role)
  const clinicName = currentClinic?.name || 'Sin consultorio'

  async function handleSignOut() {
    setIsSigningOut(true)
    await signOut()
    setIsSigningOut(false)
  }

  return (
    <section className="session-card" aria-label="Sesion actual">
      <div className="session-card-copy">
        <strong>{userName}</strong>
        <span>{roleLabel}</span>
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
    </section>
  )
}
