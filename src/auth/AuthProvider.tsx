import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getCurrentClinicForProfile } from '../services/clinicContext'
import { clearStoredActiveSection } from '../utils/activeSectionStorage'
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
import { normalizeUserRole } from './permissions'

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

const demoAuthState: AuthState = {
  ...initialAuthState,
  currentClinic: demoClinic,
  isDemoMode: true,
  isLoading: false,
  profile: demoProfile,
}

type LoginFieldErrors = {
  email?: string
  password?: string
}

function getProfileWithNormalizedRole(profile: AuthState['profile']) {
  if (!profile) {
    return null
  }

  return {
    ...profile,
    role: normalizeUserRole(profile.role),
  }
}

function validateLoginForm(email: string, password: string) {
  const errors: LoginFieldErrors = {}
  const emailValue = email.trim()

  if (!emailValue) {
    errors.email = 'Ingresa tu email.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    errors.email = 'Ingresa un email válido.'
  }

  if (!password) {
    errors.password = 'Ingresa tu contraseña.'
  } else if (password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.'
  }

  return errors
}

function hasLoginErrors(errors: LoginFieldErrors) {
  return Boolean(errors.email || errors.password)
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState)
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false)
  const hasCompletedInitialLoadRef = useRef(false)
  const [loginError, setLoginError] = useState('')

  const markInitialLoadComplete = useCallback(() => {
    hasCompletedInitialLoadRef.current = true
    setHasCompletedInitialLoad(true)
  }, [])

  const loadSessionContext = useCallback(async (
    session: AuthState['session'],
    isMounted: boolean,
  ) => {
    if (!isMounted) {
      return
    }

    if (!session) {
      clearStoredActiveSection()
      setAuthState({
        ...initialAuthState,
        isLoading: false,
      })
      markInitialLoadComplete()
      return
    }

    setAuthState((currentState) => ({
      ...currentState,
      authError: '',
      isLoading:
        !hasCompletedInitialLoadRef.current && !currentState.session,
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
      markInitialLoadComplete()
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
      markInitialLoadComplete()
      return
    }

    const normalizedProfile = getProfileWithNormalizedRole(profile)

    if (!normalizedProfile?.clinic_id) {
      setAuthState({
        authError: 'Tu usuario no tiene consultorio asignado.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile: normalizedProfile,
        session,
        user: session.user,
      })
      markInitialLoadComplete()
      return
    }

    const { data: currentClinic, error: clinicError } =
      await getCurrentClinicForProfile(normalizedProfile)

    if (!isMounted) {
      return
    }

    if (clinicError || !currentClinic) {
      setAuthState({
        authError: 'No pudimos cargar el consultorio asignado.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        profile: normalizedProfile,
        session,
        user: session.user,
      })
      markInitialLoadComplete()
      return
    }

    setAuthState({
      authError: '',
      currentClinic,
      isDemoMode: false,
      isLoading: false,
      profile: normalizedProfile,
      session,
      user: session.user,
    })
    markInitialLoadComplete()
  }, [markInitialLoadComplete])

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (!isSupabaseConfigured || !supabase) {
        if (!isMounted) {
          return
        }

        setAuthState({
          ...demoAuthState,
        })
        markInitialLoadComplete()
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
        markInitialLoadComplete()
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
  }, [loadSessionContext, markInitialLoadComplete])

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
    setLoginError('')
    clearStoredActiveSection()

    if (authState.isDemoMode || !isSupabaseConfigured || !supabase) {
      setAuthState({
        ...demoAuthState,
      })
      return
    }

    setAuthState((currentState) => ({
      ...currentState,
      authError: '',
      isLoading: true,
    }))

    const { error } = await signOutFromSupabase()

    if (error) {
      setAuthState((currentState) => ({
        ...currentState,
        authError: 'No pudimos cerrar sesión. Intenta nuevamente.',
        isLoading: false,
      }))
      return
    }

    setAuthState({
      ...initialAuthState,
      isLoading: false,
    })
  }

  if (authState.isLoading && !hasCompletedInitialLoad) {
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
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateLoginForm(email, password)
    setFieldErrors(nextErrors)

    if (hasLoginErrors(nextErrors)) {
      return
    }

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

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="email"
              disabled={!isSupabaseConfigured || isSubmitting}
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => {
                const nextEmail = event.target.value
                setEmail(nextEmail)

                if (fieldErrors.email) {
                  setFieldErrors(validateLoginForm(nextEmail, password))
                }
              }}
            />
            {fieldErrors.email && (
              <small
                className="field-message field-message--error"
                id="login-email-error"
              >
                {fieldErrors.email}
              </small>
            )}
          </label>

          <label>
            <span>Contraseña</span>
            <input
              aria-describedby={
                fieldErrors.password ? 'login-password-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
              disabled={!isSupabaseConfigured || isSubmitting}
              type="password"
              value={password}
              onChange={(event) => {
                const nextPassword = event.target.value
                setPassword(nextPassword)

                if (fieldErrors.password) {
                  setFieldErrors(validateLoginForm(email, nextPassword))
                }
              }}
            />
            {fieldErrors.password && (
              <small
                className="field-message field-message--error"
                id="login-password-error"
              >
                {fieldErrors.password}
              </small>
            )}
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
