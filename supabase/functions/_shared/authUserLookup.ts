export interface ExactAuthUser {
  creationRequestId: string | null
  email: string
  id: string
  isConfirmed: boolean
}

interface RpcError {
  code?: string
  message: string
}

export interface AuthUserLookupClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>
}

export async function lookupAuthUserByEmail(
  client: AuthUserLookupClient,
  email: string,
): Promise<ExactAuthUser | null> {
  const { data, error } = await client.rpc('lookup_auth_user_by_email', {
    target_email: email.trim().toLowerCase(),
  })

  if (error) {
    throw error
  }

  if (data === null) {
    return null
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Auth lookup returned an invalid response')
  }

  const candidate = data as Record<string, unknown>

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.isConfirmed !== 'boolean' ||
    !(
      candidate.creationRequestId === null ||
      typeof candidate.creationRequestId === 'string'
    )
  ) {
    throw new Error('Auth lookup returned an invalid user')
  }

  return {
    creationRequestId: candidate.creationRequestId,
    email: candidate.email,
    id: candidate.id,
    isConfirmed: candidate.isConfirmed,
  }
}
