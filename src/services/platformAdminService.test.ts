import { describe, expect, it, vi } from 'vitest'

import {
  listPlatformClinicsWithClient,
  mapPlatformClinicSummary,
} from './platformAdminService'

const clinicResponse = {
  activeMembersCount: 3,
  clinicId: 'clinic-1',
  clinicName: '  Clínica Central  ',
  clinicStatus: 'active' as const,
  createdAt: '2026-07-01T10:00:00.000Z',
  ownerEmail: '  owner@clinic.test ',
  ownerName: '  Dra. Ana  ',
  planId: 'pro',
  planName: 'Pro',
  subscriptionStatus: 'trial' as const,
}

function createClient(
  result: { data: unknown; error: unknown },
  accessToken = 'valid-token',
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

describe('platform admin service', () => {
  it('loads clinics and sends the current JWT', async () => {
    const client = createClient({
      data: { clinics: [clinicResponse] },
      error: null,
    })

    const result = await listPlatformClinicsWithClient(client)

    expect(result.error).toBeNull()
    expect(result.data).toEqual([
      {
        ...clinicResponse,
        clinicName: 'Clínica Central',
        ownerEmail: 'owner@clinic.test',
        ownerName: 'Dra. Ana',
      },
    ])
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'list-platform-clinics',
      {
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('returns a public message for a 403 response', async () => {
    const client = createClient({
      data: null,
      error: { context: { status: 403 } },
    })

    await expect(listPlatformClinicsWithClient(client)).resolves.toEqual({
      data: null,
      error: 'No tienes permiso para ver los consultorios.',
    })
  })

  it('keeps an empty response as a successful empty list', async () => {
    const client = createClient({ data: { clinics: [] }, error: null })

    await expect(listPlatformClinicsWithClient(client)).resolves.toEqual({
      data: [],
      error: null,
    })
  })

  it('maps nullable fields and unknown statuses safely', () => {
    expect(
      mapPlatformClinicSummary({
        ...clinicResponse,
        activeMembersCount: -4,
        clinicStatus: 'corrupt' as never,
        ownerEmail: null,
        ownerName: null,
        planId: null,
        planName: null,
        subscriptionStatus: 'corrupt' as never,
      }),
    ).toMatchObject({
      activeMembersCount: 0,
      clinicStatus: 'unknown',
      ownerEmail: null,
      ownerName: null,
      planId: null,
      planName: null,
      subscriptionStatus: 'unknown',
    })
  })
})
