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
import { isAccountActivationRoute } from '../utils/accountActivation'
import { ActivateAccountView } from '../views/ActivateAccountView'
import {
  getCurrentSession,
  getCurrentUserProfile,
  getPublicAuthErrorMessage,
  sendPasswordResetEmail,
  signInWithEmail,
  signOut as signOutFromSupabase,
} from './authService'
import { AuthContext } from './AuthContext'
import type { AuthState } from './authTypes'
import { demoClinic, demoProfile } from './demoAuth'
import {
  canAccessPlatformAdministration,
  normalizeUserRole,
} from './permissions'

interface AuthProviderProps {
  children: ReactNode
}

const initialAuthState: AuthState = {
  authError: '',
  currentClinic: null,
  isDemoMode: false,
  isLoading: true,
  isSessionContextLoading: false,
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

const isDemoModeEnabled =
  import.meta.env.VITE_ENABLE_DEMO_MODE?.trim().toLowerCase() === 'true'

type LoginFieldErrors = {
  email?: string
  password?: string
}

const ownerEmailUpdatedMessage =
  'Tu correo de acceso fue actualizado. Solicita una recuperación de contraseña para ingresar con tu nuevo correo.'

function getProfileWithNormalizedRole(profile: AuthState['profile']) {
  if (!profile) {
    return null
  }

  return {
    ...profile,
    role: normalizeUserRole(profile.role, {
      allowLegacyPlatformAdmin: true,
    }),
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

function getInitialLoginNotice() {
  if (typeof window === 'undefined') {
    return ''
  }

  const searchParams = new URLSearchParams(window.location.search)

  if (searchParams.get('authMessage') === 'owner-email-updated') {
    return ownerEmailUpdatedMessage
  }

  return ''
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState)
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false)
  const [isActivationRoute, setIsActivationRoute] = useState(() =>
    isAccountActivationRoute(),
  )
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
      isSessionContextLoading: true,
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
        isSessionContextLoading: false,
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
        isSessionContextLoading: false,
        profile: null,
        session,
        user: session.user,
      })
      markInitialLoadComplete()
      return
    }

    const normalizedProfile = getProfileWithNormalizedRole(profile)

    if (canAccessPlatformAdministration(normalizedProfile)) {
      setAuthState({
        authError: '',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        isSessionContextLoading: false,
        profile: normalizedProfile,
        session,
        user: session.user,
      })
      markInitialLoadComplete()
      return
    }

    if (normalizedProfile?.role === 'unknown') {
      setAuthState({
        authError:
          'Tu perfil no tiene un rol válido. Contacta al administrador.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        isSessionContextLoading: false,
        profile: normalizedProfile,
        session,
        user: session.user,
      })
      markInitialLoadComplete()
      return
    }

    if (!normalizedProfile?.clinic_id) {
      setAuthState({
        authError: 'Tu usuario no tiene consultorio asignado.',
        currentClinic: null,
        isDemoMode: false,
        isLoading: false,
        isSessionContextLoading: false,
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
        isSessionContextLoading: false,
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
      isSessionContextLoading: false,
      profile: normalizedProfile,
      session,
      user: session.user,
    })
    markInitialLoadComplete()
  }, [markInitialLoadComplete])

  useEffect(() => {
    function updateActivationRoute() {
      setIsActivationRoute(isAccountActivationRoute())
    }

    window.addEventListener('popstate', updateActivationRoute)
    window.addEventListener('hashchange', updateActivationRoute)

    return () => {
      window.removeEventListener('popstate', updateActivationRoute)
      window.removeEventListener('hashchange', updateActivationRoute)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (!isSupabaseConfigured || !supabase) {
        if (!isMounted) {
          return
        }

        setAuthState({
          ...initialAuthState,
          isLoading: false,
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

  function handleEnterDemoMode() {
    if (!isDemoModeEnabled || authState.session) {
      return
    }

    clearStoredActiveSection()
    setLoginError('')
    setAuthState({
      ...demoAuthState,
    })
    markInitialLoadComplete()
  }

  async function handleSignOut() {
    setLoginError('')
    clearStoredActiveSection()

    if (authState.isDemoMode || !authState.session) {
      setAuthState({
        ...initialAuthState,
        isLoading: false,
      })
      return
    }

    if (!isSupabaseConfigured || !supabase) {
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

  async function handleAccountActivated() {
    setLoginError('')
    clearStoredActiveSection()

    if (isSupabaseConfigured && supabase) {
      await signOutFromSupabase()
    }

    window.history.replaceState(null, '', '/')
    setIsActivationRoute(false)
    setAuthState({
      ...initialAuthState,
      isLoading: false,
    })
    markInitialLoadComplete()
  }

  if (isActivationRoute) {
    return <ActivateAccountView onActivated={handleAccountActivated} />
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
          Modo demo: estás usando datos locales de desarrollo.
        </div>
        {children}
      </AuthContext.Provider>
    )
  }

  if (!authState.session) {
    return (
      <LoginScreen
        errorMessage={loginError || authState.authError}
        isDemoModeEnabled={isDemoModeEnabled}
        isSupabaseConfigured={isSupabaseConfigured}
        onEnterDemoMode={handleEnterDemoMode}
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
  isDemoModeEnabled,
  isSupabaseConfigured,
  onEnterDemoMode,
  onSignIn,
}: {
  errorMessage: string
  isDemoModeEnabled: boolean
  isSupabaseConfigured: boolean
  onEnterDemoMode: () => void
  onSignIn: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [formNotice, setFormNotice] = useState(getInitialLoginNotice)
  const [password, setPassword] = useState('')
  const [isResetSubmitting, setIsResetSubmitting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormNotice('')
    const nextErrors = validateLoginForm(email, password)
    setFieldErrors(nextErrors)

    if (hasLoginErrors(nextErrors)) {
      return
    }

    setIsSubmitting(true)
    await onSignIn(email, password)
    setIsSubmitting(false)
  }

  async function handlePasswordReset() {
    setFormNotice('')
    const emailValue = email.trim()

    if (!emailValue) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        email: 'Ingresa tu email para recuperar la contraseña.',
      }))
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        email: 'Ingresa un email válido.',
      }))
      return
    }

    setIsResetSubmitting(true)
    const { error } = await sendPasswordResetEmail(emailValue)
    setIsResetSubmitting(false)

    if (error) {
      setFormNotice('')
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        email: getPublicAuthErrorMessage(error.message),
      }))
      return
    }

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      email: undefined,
    }))
    setFormNotice(
      'Si el correo existe en Supabase, recibirás un enlace para definir una nueva contraseña.',
    )
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
                setFormNotice('')

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

          {formNotice && (
            <p className="field-message field-message--success">
              {formNotice}
            </p>
          )}

          {!isSupabaseConfigured && !isDemoModeEnabled && (
            <p className="field-message field-message--error">
              Configura Supabase para iniciar sesión.
            </p>
          )}

          <button
            className="primary-action"
            disabled={!isSupabaseConfigured || isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>

          <button
            className="auth-link-action"
            disabled={!isSupabaseConfigured || isSubmitting || isResetSubmitting}
            type="button"
            onClick={handlePasswordReset}
          >
            {isResetSubmitting
              ? 'Enviando recuperación...'
              : '¿Olvidaste tu contraseña?'}
          </button>
        </form>

        {isDemoModeEnabled && (
          <button
            className="secondary-action auth-demo-action"
            type="button"
            onClick={onEnterDemoMode}
          >
            Entrar en modo demo
          </button>
        )}
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
