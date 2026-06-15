import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabaseClient'
import type { UserProfile } from '../types/database'
import type { SignInCredentials } from './authTypes'

export async function getCurrentSession() {
  if (!supabase) {
    return { data: { session: null }, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

export async function signInWithEmail({
  email,
  password,
}: SignInCredentials) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  return supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
}

export async function signOut() {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  return supabase.auth.signOut()
}

export async function getCurrentUserProfile(session: Session | null) {
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured.'),
    }
  }

  if (!session?.user.id) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle()

  return {
    data: data as UserProfile | null,
    error,
  }
}

export function getPublicAuthErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (
    normalizedMessage.includes('invalid login') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return 'Email o contraseña incorrectos.'
  }

  if (normalizedMessage.includes('supabase is not configured')) {
    return 'Supabase todavía no está configurado para iniciar sesión.'
  }

  return 'No pudimos iniciar sesión. Revisa tus datos e inténtalo nuevamente.'
}
