import { describe, expect, it, vi } from 'vitest'

import {
  lookupAuthUserByEmail,
  type AuthUserLookupClient,
} from './authUserLookup'

describe('exact Auth user lookup', () => {
  it('normalizes the email and maps the restricted RPC response', async () => {
    const client = createClient({
      creationRequestId: 'request-1',
      email: 'owner@example.com',
      id: 'owner-1',
      isConfirmed: false,
    })

    await expect(
      lookupAuthUserByEmail(client, ' OWNER@EXAMPLE.COM '),
    ).resolves.toEqual({
      creationRequestId: 'request-1',
      email: 'owner@example.com',
      id: 'owner-1',
      isConfirmed: false,
    })
    expect(client.rpc).toHaveBeenCalledWith('lookup_auth_user_by_email', {
      target_email: 'owner@example.com',
    })
  })

  it('returns null when the exact email is not registered', async () => {
    await expect(
      lookupAuthUserByEmail(createClient(null), 'missing@example.com'),
    ).resolves.toBeNull()
  })

  it('rejects malformed database responses', async () => {
    await expect(
      lookupAuthUserByEmail(
        createClient({ email: 'owner@example.com' }),
        'owner@example.com',
      ),
    ).rejects.toThrow('invalid user')
  })
})

function createClient(data: unknown): AuthUserLookupClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  }
}
