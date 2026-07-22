import { supabaseActivation } from '../lib/supabaseActivationClient'

export interface CompleteAccountActivationResult {
  data: { clinicIds: string[]; status: 'active' } | null
  error: string | null
}

interface AccountActivationFunctionClient {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null }
      error: unknown
    }>
  }
  functions: {
    invoke: (
      functionName: string,
      options: {
        headers: { Authorization: string }
        method: 'POST'
      },
    ) => Promise<{ data: unknown; error: unknown }>
  }
}

export async function completeAccountActivation(): Promise<CompleteAccountActivationResult> {
  return completeAccountActivationWithClient(
    supabaseActivation as AccountActivationFunctionClient | null,
  )
}

export async function completeAccountActivationWithClient(
  client: AccountActivationFunctionClient | null,
): Promise<CompleteAccountActivationResult> {
  if (!client) {
    return {
      data: null,
      error: 'Supabase no está configurado para activar accesos.',
    }
  }

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      data: null,
      error: 'Tu sesión de activación no es válida. Solicita un nuevo enlace.',
    }
  }

  const { data, error } = await client.functions.invoke(
    'complete-account-activation',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'POST',
    },
  )

  if (error) {
    return {
      data: null,
      error: getActivationFunctionError(error),
    }
  }

  if (!isCompleteActivationResponse(data)) {
    return {
      data: null,
      error: 'No pudimos completar la activación de tu cuenta.',
    }
  }

  return { data: data.activation, error: null }
}

function getActivationFunctionError(error: unknown) {
  const status = getFunctionErrorStatus(error)

  if (status === 401) {
    return 'Tu sesión de activación no es válida. Solicita un nuevo enlace.'
  }

  return 'No pudimos completar la activación de tu cuenta.'
}

function getFunctionErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const candidate = error as {
    context?: { status?: number }
    status?: number
  }

  return candidate.context?.status ?? candidate.status ?? null
}

function isCompleteActivationResponse(
  value: unknown,
): value is {
  activation: { clinicIds: string[]; status: 'active' }
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const activation = (value as { activation?: unknown }).activation

  if (!activation || typeof activation !== 'object') {
    return false
  }

  const candidate = activation as { clinicIds?: unknown; status?: unknown }
  return candidate.status === 'active' && Array.isArray(candidate.clinicIds)
}
