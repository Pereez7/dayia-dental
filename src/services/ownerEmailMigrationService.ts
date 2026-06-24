import { supabase } from '../lib/supabaseClient'

interface OwnerEmailMigrationResponse {
  code?: string
  message?: string
}

interface FunctionDiagnostics {
  code?: string
  status?: number
}

export const migratedOwnerEmail = 'pereezcharles@gmail.com'
export const legacyOwnerEmail = 'charles@test.com'

export async function migrateCurrentOwnerEmail() {
  if (!supabase) {
    return { error: 'Supabase is not configured yet.', success: false }
  }

  const { error } =
    await supabase.functions.invoke<OwnerEmailMigrationResponse>(
      'migrate-owner-email',
      {
        body: {},
      },
    )

  if (error) {
    return {
      error: await getOwnerEmailMigrationErrorMessage(error),
      success: false,
    }
  }

  return { success: true }
}

async function getOwnerEmailMigrationErrorMessage(error: unknown) {
  const diagnostics = await getFunctionDiagnostics(error)

  if (import.meta.env.DEV) {
    console.info('migrate-owner-email failed', diagnostics)
  }

  const code = diagnostics.code?.toUpperCase()

  if (code === 'EMAIL_ALREADY_EXISTS') {
    return 'Este correo ya está registrado.'
  }

  if (code === 'UNAUTHORIZED' || diagnostics.status === 401) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }

  if (code === 'FORBIDDEN' || diagnostics.status === 403) {
    return 'No tienes permiso para actualizar este correo.'
  }

  if (code === 'SERVER_CONFIGURATION_ERROR') {
    return 'La migración temporal de correo no está configurada.'
  }

  if (code === 'PROFILE_UPDATE_FAILED') {
    return 'Auth se actualizó, pero no pudimos actualizar el perfil.'
  }

  return 'No pudimos actualizar el correo de acceso.'
}

async function getFunctionDiagnostics(
  error: unknown,
): Promise<FunctionDiagnostics> {
  const functionsError = error as {
    context?: Response
    message?: string
  }
  const context = functionsError.context

  if (!context) {
    return {}
  }

  const diagnostics: FunctionDiagnostics = {
    status: context.status,
  }

  try {
    const body = (await context.clone().json()) as OwnerEmailMigrationResponse
    diagnostics.code = body.code
  } catch {
    // Keep the generic fallback message.
  }

  return diagnostics
}
