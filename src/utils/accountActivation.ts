export interface ActivationLocationLike {
  hash?: string
  pathname?: string
}

export interface ActivationPasswordValues {
  confirmPassword: string
  password: string
}

export interface ActivationPasswordErrors {
  confirmPassword?: string
  password?: string
}

export interface AccountActivationLock {
  current: boolean
}

interface AccountActivationFlowDependencies {
  completeActivation: () => Promise<{ error: string | null }>
  updatePassword: () => Promise<{
    error: { code?: string; message?: string } | null
  }>
}

export interface AccountActivationFlowResult {
  error: string | null
  status: 'error' | 'ignored' | 'success'
}

export const accountActivationPath = '/activar-cuenta'

export function isAccountActivationRoute(
  locationLike: ActivationLocationLike = getCurrentLocation(),
) {
  return locationLike.pathname === accountActivationPath
}

export function validateActivationPasswordForm({
  confirmPassword,
  password,
}: ActivationPasswordValues) {
  const errors: ActivationPasswordErrors = {}

  if (!password) {
    errors.password = 'Ingresa una nueva contraseña.'
  } else if (password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirma tu nueva contraseña.'
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.'
  }

  return errors
}

export function hasActivationPasswordErrors(
  errors: ActivationPasswordErrors,
) {
  return Boolean(errors.password || errors.confirmPassword)
}

export async function runAccountActivationOnce(
  lock: AccountActivationLock,
  dependencies: AccountActivationFlowDependencies,
): Promise<AccountActivationFlowResult> {
  if (lock.current) {
    return { error: null, status: 'ignored' }
  }

  lock.current = true

  try {
    const passwordResult = await dependencies.updatePassword()

    if (
      passwordResult.error &&
      !isPasswordAlreadyConfiguredError(passwordResult.error)
    ) {
      return {
        error: 'No pudimos guardar tu contraseña. Solicita un nuevo enlace.',
        status: 'error',
      }
    }

    const activationResult = await dependencies.completeActivation()

    if (activationResult.error) {
      return { error: activationResult.error, status: 'error' }
    }

    return { error: null, status: 'success' }
  } catch {
    return {
      error: 'No pudimos completar la activación de tu cuenta.',
      status: 'error',
    }
  } finally {
    lock.current = false
  }
}

export function isPasswordAlreadyConfiguredError(error: {
  code?: string
  message?: string
}) {
  return (
    error.code?.toLowerCase() === 'same_password' ||
    error.message?.toLowerCase().includes('different from the old password') ===
      true
  )
}

function getCurrentLocation(): ActivationLocationLike {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    hash: window.location.hash,
    pathname: window.location.pathname,
  }
}
