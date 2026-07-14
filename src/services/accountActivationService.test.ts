import { describe, expect, it, vi } from 'vitest'

import { completeAccountActivationWithClient } from './accountActivationService'

function createClient(
  result: { data: unknown; error: unknown },
  accessToken = 'activation-token',
) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: accessToken ? { access_token: accessToken } : null },
        error: null,
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue(result),
    },
  }
}

describe('account activation service', () => {
  it('completes activation with the current JWT', async () => {
    const client = createClient({
      data: {
        activation: { clinicIds: ['clinic-1'], status: 'active' },
      },
      error: null,
    })

    await expect(completeAccountActivationWithClient(client)).resolves.toEqual({
      data: { clinicIds: ['clinic-1'], status: 'active' },
      error: null,
    })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'complete-account-activation',
      {
        headers: { Authorization: 'Bearer activation-token' },
        method: 'POST',
      },
    )
  })

  it('rejects a missing activation session', async () => {
    const client = createClient({ data: null, error: null }, '')

    await expect(completeAccountActivationWithClient(client)).resolves.toEqual({
      data: null,
      error: 'Tu sesión de activación no es válida. Solicita un nuevo enlace.',
    })
    expect(client.functions.invoke).not.toHaveBeenCalled()
  })

  it('maps Function errors without technical details', async () => {
    const client = createClient({
      data: null,
      error: { context: { status: 500 }, message: 'database detail' },
    })

    await expect(completeAccountActivationWithClient(client)).resolves.toEqual({
      data: null,
      error: 'No pudimos completar la activación de tu cuenta.',
    })
  })
})
