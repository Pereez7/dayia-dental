import { describe, expect, it, vi } from 'vitest'

import {
  assertPlatformClinicCreationAllowed,
  createPlatformClinicPayloadFingerprint,
  createPlatformClinicRecords,
  normalizeCreatePlatformClinicPayload,
  type CreatePlatformClinicRepository,
  type PlatformClinicAuthUser,
  type PlatformClinicCreationRequest,
} from './createPlatformClinic'

const context = {
  requestedBy: '10000000-0000-4000-8000-000000000001',
  requestId: '20000000-0000-4000-8000-000000000002',
}

const input = normalizeCreatePlatformClinicPayload({
  clinicName: 'Clínica Norte',
  ownerEmail: 'owner@example.com',
  ownerName: 'Dra. Andrea',
  planId: 'medium',
  priceTier: 'founder',
})

describe('create-platform-clinic helpers', () => {
  it('rejects a requester who is not platform_admin', () => {
    expect(() => assertPlatformClinicCreationAllowed(false, 'true')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
    )
  })

  it('rejects creation unless the flag is exactly true', () => {
    for (const value of [undefined, 'false', 'TRUE', ' true ']) {
      expect(() => assertPlatformClinicCreationAllowed(true, value)).toThrowError(
        expect.objectContaining({
          code: 'PLATFORM_CREATE_DISABLED',
          message: 'La creación real de consultorios está deshabilitada.',
          status: 409,
        }),
      )
    }
  })

  it('normalizes a valid payload', () => {
    expect(
      normalizeCreatePlatformClinicPayload({
        clinicName: '  Clínica   Norte ',
        ownerEmail: ' OWNER@EXAMPLE.COM ',
        ownerName: ' Dra.   Andrea Pérez ',
        planId: 'pro',
        priceTier: 'founder',
      }),
    ).toEqual({
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea Pérez',
      planId: 'pro',
      priceTier: 'founder',
    })
  })

  it.each([
    [{}, 'INVALID_PAYLOAD'],
    [
      {
        clinicName: 'A',
        ownerName: 'B',
        ownerEmail: 'correo',
        planId: 'basic',
        priceTier: 'standard',
      },
      'INVALID_PAYLOAD',
    ],
    [
      {
        clinicName: 'A',
        ownerName: 'B',
        ownerEmail: 'a@b.com',
        planId: 'enterprise',
        priceTier: 'standard',
      },
      'INVALID_PAYLOAD',
    ],
    [
      {
        clinicName: 'A',
        ownerName: 'B',
        ownerEmail: 'a@b.com',
        planId: 'basic',
        priceTier: 'custom',
      },
      'INVALID_PAYLOAD',
    ],
  ])('rejects invalid payload %#', (payload, code) => {
    expect(() => normalizeCreatePlatformClinicPayload(payload)).toThrowError(
      expect.objectContaining({ code, status: 400 }),
    )
  })

  it('generates the same fingerprint for equivalent normalized input', async () => {
    const equivalent = normalizeCreatePlatformClinicPayload({
      clinicName: '  CLÍNICA   NORTE ',
      ownerEmail: ' OWNER@EXAMPLE.COM ',
      ownerName: ' dra.   andrea ',
      planId: 'medium',
      priceTier: 'founder',
    })

    await expect(
      createPlatformClinicPayloadFingerprint(input),
    ).resolves.toBe(
      await createPlatformClinicPayloadFingerprint(equivalent),
    )
  })

  it('invites the owner and commits all public records atomically', async () => {
    const repository = createRepository()

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).resolves.toEqual(expectedResponse())
    expect(repository.beginCreation).toHaveBeenCalledOnce()
    expect(repository.createOwnerInvitation).toHaveBeenCalledWith(
      'owner@example.com',
      'Dra. Andrea',
      context.requestId,
    )
    expect(repository.completeCreation).toHaveBeenCalledWith(
      context.requestId,
      'owner-1',
    )
    expect(repository.deleteCreatedOwner).not.toHaveBeenCalled()
  })

  it('reports bounded phases without exposing clinic data', async () => {
    const repository = createRepository()
    const phases: string[] = []

    await createPlatformClinicRecords(input, context, repository, {
      measure: async (phase, operation) => {
        phases.push(phase)
        return await operation()
      },
    })

    expect(phases).toEqual([
      'creation_preflight',
      'owner_lookup',
      'owner_invitation',
      'atomic_persistence',
    ])
    expect(JSON.stringify(phases)).not.toContain('owner@example.com')
    expect(JSON.stringify(phases)).not.toContain('Clínica Norte')
  })

  it('returns a completed request without another Auth or database write', async () => {
    const repository = createRepository()
    vi.mocked(repository.beginCreation).mockResolvedValue(
      creation({ status: 'completed' }),
    )

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).resolves.toEqual(expectedResponse())
    expect(repository.findOwnerByEmail).not.toHaveBeenCalled()
    expect(repository.createOwnerInvitation).not.toHaveBeenCalled()
    expect(repository.completeCreation).not.toHaveBeenCalled()
  })

  it('resumes a reserved request from its exact Auth metadata', async () => {
    const repository = createRepository()
    vi.mocked(repository.findOwnerByEmail).mockResolvedValue(owner())

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).resolves.toEqual(expectedResponse())
    expect(repository.createOwnerInvitation).not.toHaveBeenCalled()
    expect(repository.completeCreation).toHaveBeenCalledOnce()
  })

  it('recovers when Auth created the invitation but its response was lost', async () => {
    const repository = createRepository()
    vi.mocked(repository.findOwnerByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(owner())
    vi.mocked(repository.createOwnerInvitation).mockRejectedValue(
      new Error('network'),
    )

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).resolves.toEqual(expectedResponse())
    expect(repository.completeCreation).toHaveBeenCalledOnce()
    expect(repository.failCreation).not.toHaveBeenCalled()
  })

  it('rejects an Auth email owned by another operation', async () => {
    const repository = createRepository()
    vi.mocked(repository.findOwnerByEmail).mockResolvedValue(
      owner({ creationRequestId: 'another-request' }),
    )

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'OWNER_EMAIL_ALREADY_REGISTERED',
        status: 409,
      }),
    )
    expect(repository.failCreation).toHaveBeenCalledWith(
      context.requestId,
      'OWNER_EMAIL_ALREADY_REGISTERED',
    )
    expect(repository.deleteCreatedOwner).not.toHaveBeenCalled()
  })

  it('treats an ambiguous commit response as success when PostgreSQL completed', async () => {
    const repository = createRepository()
    vi.mocked(repository.completeCreation).mockRejectedValue(new Error('timeout'))
    vi.mocked(repository.getCreation).mockResolvedValue(
      creation({ status: 'completed' }),
    )

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).resolves.toEqual(expectedResponse())
    expect(repository.deleteCreatedOwner).not.toHaveBeenCalled()
    expect(repository.failCreation).not.toHaveBeenCalled()
  })

  it('deletes only its invited Auth user after a confirmed uncommitted failure', async () => {
    const repository = createRepository()
    vi.mocked(repository.completeCreation).mockRejectedValue(new Error('db'))
    vi.mocked(repository.getCreation).mockResolvedValue(creation())

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'CREATE_FAILED', status: 500 }),
    )
    expect(repository.deleteCreatedOwner).toHaveBeenCalledWith('owner-1')
    expect(repository.failCreation).toHaveBeenCalledWith(
      context.requestId,
      'CREATE_FAILED',
    )
  })

  it('never deletes Auth when the PostgreSQL state cannot be confirmed', async () => {
    const repository = createRepository()
    vi.mocked(repository.completeCreation).mockRejectedValue(new Error('timeout'))
    vi.mocked(repository.getCreation).mockRejectedValue(new Error('network'))

    await expect(
      createPlatformClinicRecords(input, context, repository),
    ).rejects.toEqual(
      expect.objectContaining({ code: 'CREATE_STATE_UNKNOWN', status: 503 }),
    )
    expect(repository.deleteCreatedOwner).not.toHaveBeenCalled()
    expect(repository.failCreation).not.toHaveBeenCalled()
  })
})

function createRepository(): CreatePlatformClinicRepository {
  return {
    beginCreation: vi.fn().mockResolvedValue(creation()),
    completeCreation: vi.fn().mockResolvedValue(
      creation({ status: 'completed' }),
    ),
    createOwnerInvitation: vi.fn().mockResolvedValue(owner()),
    deleteCreatedOwner: vi.fn().mockResolvedValue(undefined),
    failCreation: vi.fn().mockResolvedValue(undefined),
    findOwnerByEmail: vi.fn().mockResolvedValue(null),
    getCreation: vi.fn().mockResolvedValue(creation()),
  }
}

function creation(
  overrides: Partial<PlatformClinicCreationRequest> = {},
): PlatformClinicCreationRequest {
  const completed = overrides.status === 'completed'

  return {
    activationStatus: completed ? 'pending' : null,
    clinicId: completed ? 'clinic-1' : null,
    clinicName: 'Clínica Norte',
    ownerEmail: 'owner@example.com',
    ownerName: 'Dra. Andrea',
    ownerUserId: completed ? 'owner-1' : null,
    planId: 'medium',
    priceTier: 'founder',
    requestId: context.requestId,
    status: 'reserved',
    ...overrides,
  }
}

function owner(
  overrides: Partial<PlatformClinicAuthUser> = {},
): PlatformClinicAuthUser {
  return {
    creationRequestId: context.requestId,
    email: 'owner@example.com',
    id: 'owner-1',
    isConfirmed: false,
    ...overrides,
  }
}

function expectedResponse() {
  return {
    activation: { status: 'pending' },
    clinic: {
      clinicId: 'clinic-1',
      clinicName: 'Clínica Norte',
      clinicStatus: 'pending_activation',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'medium',
      priceTier: 'founder',
    },
  }
}
