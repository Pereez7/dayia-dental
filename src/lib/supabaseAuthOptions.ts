import { accountActivationPath } from '../utils/accountActivation'

export const activationAuthStorageKey = 'dayia-dental-activation-auth'

export function shouldDetectMainAuthSessionInUrl(pathname: string) {
  return pathname !== accountActivationPath
}

export function getMainAuthOptions(pathname: string) {
  return {
    detectSessionInUrl: shouldDetectMainAuthSessionInUrl(pathname),
  }
}

export function getActivationAuthOptions(storage: Storage) {
  return {
    autoRefreshToken: false,
    detectSessionInUrl: true,
    persistSession: true,
    storage,
    storageKey: activationAuthStorageKey,
  }
}
