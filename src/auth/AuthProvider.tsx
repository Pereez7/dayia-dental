import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getCurrentClinicForProfile } from '../services/clinicContext'
import {
  getCurrentSession,
  getCurrentUserProfile,
  getPublicAuthErrorMessage,
  signInWithEmail,
  signOut as signOutFromSupabase,
} from './authService'
import { AuthContext } from './AuthContext'
import type { AuthState } from './authTypes'
import { demoClinic, demoProfile } from './demoAuth'

interface AuthProviderProps {
  children: ReactNode
}

const initialAuthState: AuthState = {
  authError: '',
  currentClinic: null,
  isDemoMode: false,
  isLoading: true,
  profile: null,
  session: null,
  user: null,
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState)
  const [loginError, setLoginError] = useState('')

  async function loadSessionContext(
    session: AuthState['session'],
    isMounted: boolean,
  ) {
    if (!isMounted) {
      return
    }

    if (!session) {
      setAuthState({
        ...initialAuthState,
        isLoading: false,
      })
      return
    }

    setAuthState((currentState) => ({
      ...currentState,
      authError: '',
      isLoading: true,
      session,
      user: session.user,
    }))

    const { data: profile, error: profileError } =
      await getCurrentUserProfile(session)

    if (!isMounted) {
      return
    }

    if (profileError) {
      setAuthState({
        authError: 'No pudimos cargar el perfil del usuario.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile: null,
        session,
        user: session.user,
      })
      return
    }

    if (!profile) {
      setAuthState({
        authError: 'Tu usuario aún no está vinculado a un consultorio.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile: null,
        session,
        user: session.user,
      })
      return
    }

    if (!profile.clinic_id) {
      setAuthState({
        authError: 'Tu usuario no tiene consultorio asignado.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile,
        session,
        user: session.user,
      })
      return
    }

    const { data: currentClinic, error: clinicError } =
      await getCurrentClinicForProfile(profile)

    if (!isMounted) {
      return
    }

    if (clinicError || !currentClinic) {
      setAuthState({
        authError: 'No pudimos cargar el consultorio asignado.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile,
        session,
        user: session.user,
      })
      return
    }

    setAuthState({
      authError: '',
      currentClinic,
      isDemoMode: false,
      isLoading: false,
      profile,
      session,
      user: session.user,
    })
  }

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (!isSupabaseConfigured || !supabase) {
        if (!isMounted) {
          return
        }

        setAuthState({
          ...initialAuthState,
          currentClinic: demoClinic,
          isDemoMode: true,
          isLoading: false,
          profile: demoProfile,
        })
        return
      }

      const { data, error } = await getCurrentSession()

      if (!isMounted) {
        return
      }

      if (error) {
        setAuthState({
          ...initialAuthState,
          authError: 'No pudimos revisar la sesión actual.',
          isLoading: false,
        })
        return
      }

      await loadSessionContext(data.session, isMounted)
    }

    initializeAuth()

    if (!supabase) {
      return () => {
        isMounted = false
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionContext(session, isMounted)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignIn(email: string, password: string) {
    setLoginError('')
    setAuthState((currentState) => ({
      ...currentState,
      isLoading: true,
    }))

    const { data, error } = await signInWithEmail({ email, password })

    if (error) {
      setAuthState((currentState) => ({
        ...currentState,
        isLoading: false,
      }))
      setLoginError(getPublicAuthErrorMessage(error.message))
      return
    }

    await loadSessionContext(data.session, true)
  }

  async function handleSignOut() {
    await signOutFromSupabase()
    setLoginError('')
    setAuthState({
      ...initialAuthState,
      isLoading: false,
    })
  }

  if (authState.isLoading) {
    return <AuthStatusScreen message="Preparando tu sesión..." />
  }

  if (authState.isDemoMode) {
    return (
      <AuthContext.Provider
        value={{
          ...authState,
          signOut: handleSignOut,
        }}
      >
        <div className="demo-mode-banner" role="status">
          Modo demo: Supabase no está configurado.
        </div>
        {children}
      </AuthContext.Provider>
    )
  }

  if (!authState.session) {
    return (
      <LoginScreen
        errorMessage={loginError || authState.authError}
        isSupabaseConfigured={isSupabaseConfigured}
        onSignIn={handleSignIn}
      />
    )
  }

  if (authState.authError) {
    return (
      <AuthStatusScreen
        actionLabel="Cerrar sesión"
        message={authState.authError}
        onAction={handleSignOut}
      />
    )
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function LoginScreen({
  errorMessage,
  isSupabaseConfigured,
  onSignIn,
}: {
  errorMessage: string
  isSupabaseConfigured: boolean
  onSignIn: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    await onSignIn(email, password)
    setIsSubmitting(false)
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-heading">
          <span>DayIA Dental</span>
          <h1 id="auth-title">Ingresa a tu consultorio</h1>
          <p>
            Accede con tu usuario para preparar la operación diaria del
            consultorio.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={!isSupabaseConfigured || isSubmitting}
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              autoComplete="current-password"
              disabled={!isSupabaseConfigured || isSubmitting}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage && (
            <p className="field-message field-message--error">{errorMessage}</p>
          )}

          <button
            className="primary-action"
            disabled={!isSupabaseConfigured || isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}

function AuthStatusScreen({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string
  message: string
  onAction?: () => void
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-live="polite">
        <div className="auth-heading">
          <span>DayIA Dental</span>
          <h1>Acceso al consultorio</h1>
          <p>{message}</p>
        </div>

        {actionLabel && onAction && (
          <button className="secondary-action" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  )
}
