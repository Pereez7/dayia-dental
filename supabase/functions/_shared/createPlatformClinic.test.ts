import { describe, expect, it, vi } from 'vitest'

import {
  assertPlatformClinicCreationAllowed,
  createPlatformClinicRecords,
  CreatePlatformClinicError,
  getInitialClinicTrial,
  normalizeCreatePlatformClinicPayload,
  type CreatePlatformClinicRepository,
} from './createPlatformClinic'

describe('create-platform-clinic helpers', () => {
  it('creates a 15 day trial followed by 5 grace days', () => {
    expect(
      getInitialClinicTrial(new Date('2026-07-20T12:00:00.000Z')),
    ).toEqual({
      graceEndsAt: '2026-08-09T12:00:00.000Z',
      trialEndsAt: '2026-08-04T12:00:00.000Z',
      trialStartsAt: '2026-07-20T12:00:00.000Z',
    })
  })
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
    [{ clinicName: 'A', ownerName: 'B', ownerEmail: 'correo', planId: 'basic', priceTier: 'standard' }, 'INVALID_PAYLOAD'],
    [{ clinicName: 'A', ownerName: 'B', ownerEmail: 'a@b.com', planId: 'enterprise', priceTier: 'standard' }, 'INVALID_PAYLOAD'],
    [{ clinicName: 'A', ownerName: 'B', ownerEmail: 'a@b.com', planId: 'basic', priceTier: 'custom' }, 'INVALID_PAYLOAD'],
  ])('rejects invalid payload %#', (payload, code) => {
    expect(() => normalizeCreatePlatformClinicPayload(payload)).toThrowError(
      expect.objectContaining({ code, status: 400 }),
    )
  })

  it('creates clinic, invited owner, membership and subscription', async () => {
    const repository = createRepository()
    const input = normalizeCreatePlatformClinicPayload({
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'medium',
      priceTier: 'founder',
    })

    await expect(createPlatformClinicRecords(input, repository)).resolves.toEqual({
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
    })
    expect(repository.createOwnerInvitation).toHaveBeenCalledOnce()
    expect(repository.createMembership).toHaveBeenCalledWith(
      'clinic-1',
      'owner-1',
      'pending_activation',
    )
    expect(repository.createSubscription).toHaveBeenCalledWith(
      'clinic-1',
      'medium',
      'founder',
    )
  })

  it('reuses an existing active owner without duplicating Auth', async () => {
    const repository = createRepository()
    vi.mocked(repository.findOwnerByEmail).mockResolvedValue({
      email: 'owner@example.com',
      fullName: 'Dra. Existente',
      id: 'existing-owner',
      isActive: true,
    })

    const result = await createPlatformClinicRecords(
      normalizeCreatePlatformClinicPayload({
        clinicName: 'Clínica Sur',
        ownerEmail: 'owner@example.com',
        ownerName: 'Nombre nuevo',
        planId: 'basic',
        priceTier: 'standard',
      }),
      repository,
    )

    expect(result.activation.status).toBe('already_active')
    expect(result.clinic.ownerName).toBe('Dra. Existente')
    expect(repository.createOwnerInvitation).not.toHaveBeenCalled()
    expect(repository.createMembership).toHaveBeenCalledWith(
      'clinic-1',
      'existing-owner',
      'active',
    )
  })

  it('compensates clinic and newly-created owner after a partial failure', async () => {
    const repository = createRepository()
    vi.mocked(repository.createSubscription).mockRejectedValue(new Error('db'))

    await expect(
      createPlatformClinicRecords(
        normalizeCreatePlatformClinicPayload({
          clinicName: 'Clínica Sur',
          ownerEmail: 'owner@example.com',
          ownerName: 'Dra. Andrea',
          planId: 'basic',
          priceTier: 'standard',
        }),
        repository,
      ),
    ).rejects.toBeInstanceOf(CreatePlatformClinicError)
    expect(repository.deleteClinic).toHaveBeenCalledWith('clinic-1')
    expect(repository.deleteCreatedOwner).toHaveBeenCalledWith('owner-1')
  })
})

function createRepository(): CreatePlatformClinicRepository {
  return {
    createClinic: vi.fn().mockResolvedValue({ id: 'clinic-1' }),
    createMembership: vi.fn().mockResolvedValue(undefined),
    createOwnerInvitation: vi.fn().mockResolvedValue({
      activationStatus: 'pending',
      owner: {
        email: 'owner@example.com',
        fullName: 'Dra. Andrea',
        id: 'owner-1',
        isActive: false,
      },
    }),
    createSubscription: vi.fn().mockResolvedValue(undefined),
    deleteClinic: vi.fn().mockResolvedValue(undefined),
    deleteCreatedOwner: vi.fn().mockResolvedValue(undefined),
    findClinicByNormalizedName: vi.fn().mockResolvedValue(false),
    findOwnerByEmail: vi.fn().mockResolvedValue(null),
    updateOwnerProfileIfMissing: vi.fn().mockResolvedValue(undefined),
  }
}
