import { describe, expect, it } from 'vitest'

import {
  activationAuthStorageKey,
  getActivationAuthOptions,
  getMainAuthOptions,
  shouldDetectMainAuthSessionInUrl,
} from './supabaseAuthOptions'

describe('Supabase auth client options', () => {
  it('keeps the main client from consuming activation links', () => {
    expect(shouldDetectMainAuthSessionInUrl('/activar-cuenta')).toBe(false)
    expect(getMainAuthOptions('/activar-cuenta').detectSessionInUrl).toBe(false)
  })

  it('keeps URL session detection enabled outside activation', () => {
    expect(shouldDetectMainAuthSessionInUrl('/')).toBe(true)
    expect(shouldDetectMainAuthSessionInUrl('/otra-ruta')).toBe(true)
  })

  it('isolates the temporary activation session in dedicated storage', () => {
    const storage = {
      clear() {},
      getItem() {
        return null
      },
      key() {
        return null
      },
      length: 0,
      removeItem() {},
      setItem() {},
    } satisfies Storage
    const options = getActivationAuthOptions(storage)

    expect(options).toMatchObject({
      autoRefreshToken: false,
      detectSessionInUrl: true,
      persistSession: true,
      storageKey: activationAuthStorageKey,
    })
    expect(options.storage).toBe(storage)
  })
})
