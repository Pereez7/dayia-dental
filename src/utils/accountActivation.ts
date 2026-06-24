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

function getCurrentLocation(): ActivationLocationLike {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    hash: window.location.hash,
    pathname: window.location.pathname,
  }
}
