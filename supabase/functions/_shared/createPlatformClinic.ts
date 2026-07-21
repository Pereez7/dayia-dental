export type PlatformClinicActivationStatus =
  | 'pending'
  | 'already_active'
  | 'not_sent'

export interface CreatePlatformClinicInput {
  clinicName: string
  ownerEmail: string
  ownerName: string
  planId: 'basic' | 'medium' | 'pro'
}

export interface CreatePlatformClinicResponse {
  activation: {
    activationUrl?: string
    status: PlatformClinicActivationStatus
  }
  clinic: {
    clinicId: string
    clinicName: string
    clinicStatus: 'pending_activation'
    ownerEmail: string | null
    ownerName: string | null
    planId: CreatePlatformClinicInput['planId']
  }
}

export interface PlatformClinicOwner {
  email: string
  fullName: string | null
  id: string
  isActive: boolean
}

export interface CreatedPlatformClinicOwner {
  activationStatus: PlatformClinicActivationStatus
  owner: PlatformClinicOwner
}

export function getInitialClinicTrial(referenceDate = new Date()) {
  const trialEndsAt = new Date(referenceDate.getTime() + 15 * 86_400_000)
  const graceEndsAt = new Date(trialEndsAt.getTime() + 5 * 86_400_000)

  return {
    graceEndsAt: graceEndsAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    trialStartsAt: referenceDate.toISOString(),
  }
}

export interface CreatePlatformClinicRepository {
  createClinic: (name: string) => Promise<{ id: string }>
  createMembership: (
    clinicId: string,
    ownerId: string,
    status: 'active' | 'pending_activation',
  ) => Promise<void>
  createOwnerInvitation: (
    clinicId: string,
    email: string,
    fullName: string,
  ) => Promise<CreatedPlatformClinicOwner>
  createSubscription: (
    clinicId: string,
    planId: CreatePlatformClinicInput['planId'],
  ) => Promise<void>
  deleteClinic: (clinicId: string) => Promise<void>
  deleteCreatedOwner: (ownerId: string) => Promise<void>
  findClinicByNormalizedName: (name: string) => Promise<boolean>
  findOwnerByEmail: (email: string) => Promise<PlatformClinicOwner | null>
  updateOwnerProfileIfMissing: (
    ownerId: string,
    email: string,
    fullName: string,
  ) => Promise<void>
}

export class CreatePlatformClinicError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'CreatePlatformClinicError'
  }
}

const validPlans = new Set(['basic', 'medium', 'pro'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCreatePlatformClinicPayload(
  payload: unknown,
): CreatePlatformClinicInput {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidPayload('Revisa los datos del consultorio.')
  }

  const candidate = payload as Record<string, unknown>
  const clinicName = normalizeName(candidate.clinicName)
  const ownerName = normalizeName(candidate.ownerName)
  const ownerEmail =
    typeof candidate.ownerEmail === 'string'
      ? candidate.ownerEmail.trim().toLowerCase()
      : ''
  const planId =
    typeof candidate.planId === 'string'
      ? candidate.planId.trim().toLowerCase()
      : ''

  if (!clinicName) {
    throw invalidPayload('Ingresa el nombre del consultorio.')
  }

  if (!ownerName) {
    throw invalidPayload('Ingresa el nombre del propietario.')
  }

  if (!ownerEmail || !emailPattern.test(ownerEmail)) {
    throw invalidPayload('Ingresa un email válido para el propietario.')
  }

  if (!validPlans.has(planId)) {
    throw invalidPayload('Selecciona un plan válido.')
  }

  return {
    clinicName,
    ownerEmail,
    ownerName,
    planId: planId as CreatePlatformClinicInput['planId'],
  }
}

export function assertPlatformClinicCreationAllowed(
  isPlatformAdmin: boolean,
  createEnabled: string | undefined,
) {
  if (!isPlatformAdmin) {
    throw new CreatePlatformClinicError(
      'FORBIDDEN',
      'No tienes permiso para crear consultorios.',
      403,
    )
  }

  if (createEnabled !== 'true') {
    throw new CreatePlatformClinicError(
      'PLATFORM_CREATE_DISABLED',
      'La creación real de consultorios está deshabilitada.',
      409,
    )
  }
}

export async function createPlatformClinicRecords(
  input: CreatePlatformClinicInput,
  repository: CreatePlatformClinicRepository,
): Promise<CreatePlatformClinicResponse> {
  if (await repository.findClinicByNormalizedName(input.clinicName)) {
    throw new CreatePlatformClinicError(
      'CLINIC_ALREADY_EXISTS',
      'Ya existe un consultorio con ese nombre.',
      409,
    )
  }

  let clinicId: string | null = null
  let createdOwnerId: string | null = null

  try {
    clinicId = (await repository.createClinic(input.clinicName)).id

    let owner = await repository.findOwnerByEmail(input.ownerEmail)
    let activationStatus: PlatformClinicActivationStatus

    if (owner) {
      await repository.updateOwnerProfileIfMissing(
        owner.id,
        input.ownerEmail,
        input.ownerName,
      )
      owner = {
        ...owner,
        fullName: owner.fullName?.trim() || input.ownerName,
      }
      activationStatus = owner.isActive ? 'already_active' : 'not_sent'
    } else {
      const createdOwner = await repository.createOwnerInvitation(
        clinicId,
        input.ownerEmail,
        input.ownerName,
      )
      owner = createdOwner.owner
      createdOwnerId = owner.id
      activationStatus = createdOwner.activationStatus
    }

    await repository.createMembership(
      clinicId,
      owner.id,
      owner.isActive ? 'active' : 'pending_activation',
    )
    await repository.createSubscription(clinicId, input.planId)

    return {
      activation: { status: activationStatus },
      clinic: {
        clinicId,
        clinicName: input.clinicName,
        clinicStatus: 'pending_activation',
        ownerEmail: owner.email,
        ownerName: owner.fullName,
        planId: input.planId,
      },
    }
  } catch (error) {
    if (clinicId) {
      await repository.deleteClinic(clinicId).catch(() => undefined)
    }

    if (createdOwnerId) {
      await repository.deleteCreatedOwner(createdOwnerId).catch(() => undefined)
    }

    if (error instanceof CreatePlatformClinicError) {
      throw error
    }

    throw new CreatePlatformClinicError(
      'CREATE_FAILED',
      'No pudimos preparar el consultorio. Intenta nuevamente.',
      500,
    )
  }
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function invalidPayload(message: string) {
  return new CreatePlatformClinicError('INVALID_PAYLOAD', message, 400)
}
