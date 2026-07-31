import type {
  EdgePerformanceInstrumentation,
  EdgePerformancePhase,
} from './performance.ts'

export type PlatformClinicActivationStatus =
  | 'pending'
  | 'already_active'
  | 'not_sent'

export interface CreatePlatformClinicInput {
  clinicName: string
  ownerEmail: string
  ownerName: string
  planId: 'basic' | 'medium' | 'pro'
  priceTier: 'standard' | 'founder'
}

export interface CreatePlatformClinicResponse {
  activation: {
    activationUrl?: string
    status: PlatformClinicActivationStatus
  }
  clinic: {
    clinicId: string
    clinicName: string
    clinicStatus: 'active' | 'pending_activation'
    ownerEmail: string | null
    ownerName: string | null
    planId: CreatePlatformClinicInput['planId']
    priceTier: CreatePlatformClinicInput['priceTier']
  }
}

export interface PlatformClinicCreationRequest {
  activationStatus: Exclude<PlatformClinicActivationStatus, 'not_sent'> | null
  clinicId: string | null
  clinicName: string
  ownerEmail: string
  ownerName: string
  ownerUserId: string | null
  planId: CreatePlatformClinicInput['planId']
  priceTier: CreatePlatformClinicInput['priceTier']
  requestId: string
  status: 'completed' | 'failed' | 'reserved'
}

export interface PlatformClinicAuthUser {
  creationRequestId: string | null
  email: string
  id: string
  isConfirmed: boolean
}

export interface PlatformClinicCreationContext {
  requestedBy: string
  requestId: string
}

export interface CreatePlatformClinicRepository {
  beginCreation: (
    input: CreatePlatformClinicInput,
    context: PlatformClinicCreationContext & { payloadFingerprint: string },
  ) => Promise<PlatformClinicCreationRequest>
  completeCreation: (
    requestId: string,
    ownerId: string,
  ) => Promise<PlatformClinicCreationRequest>
  createOwnerInvitation: (
    email: string,
    fullName: string,
    requestId: string,
  ) => Promise<PlatformClinicAuthUser>
  deleteCreatedOwner: (ownerId: string) => Promise<void>
  failCreation: (requestId: string, errorCode: string) => Promise<void>
  findOwnerByEmail: (
    email: string,
  ) => Promise<PlatformClinicAuthUser | null>
  getCreation: (
    requestId: string,
  ) => Promise<PlatformClinicCreationRequest | null>
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
const validPriceTiers = new Set(['standard', 'founder'])
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
  const priceTier =
    typeof candidate.priceTier === 'string'
      ? candidate.priceTier.trim().toLowerCase()
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

  if (!validPriceTiers.has(priceTier)) {
    throw invalidPayload('Selecciona una tarifa inicial válida.')
  }

  return {
    clinicName,
    ownerEmail,
    ownerName,
    planId: planId as CreatePlatformClinicInput['planId'],
    priceTier: priceTier as CreatePlatformClinicInput['priceTier'],
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

export async function createPlatformClinicPayloadFingerprint(
  input: CreatePlatformClinicInput,
) {
  const canonicalPayload = JSON.stringify([
    normalizeComparableName(input.clinicName),
    normalizeComparableName(input.ownerName),
    input.ownerEmail.trim().toLowerCase(),
    input.planId,
    input.priceTier,
  ])
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalPayload),
  )

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function createPlatformClinicRecords(
  input: CreatePlatformClinicInput,
  context: PlatformClinicCreationContext,
  repository: CreatePlatformClinicRepository,
  performance?: EdgePerformanceInstrumentation,
): Promise<CreatePlatformClinicResponse> {
  const payloadFingerprint = await createPlatformClinicPayloadFingerprint(input)
  const creation = await measurePhase(
    performance,
    'creation_preflight',
    () =>
      repository.beginCreation(input, {
        ...context,
        payloadFingerprint,
      }),
  )

  if (creation.status === 'completed') {
    return buildResponse(creation)
  }

  let owner = await measurePhase(
    performance,
    'owner_lookup',
    () => repository.findOwnerByEmail(input.ownerEmail),
  )

  if (owner && owner.creationRequestId !== creation.requestId) {
    await recordFailure(
      repository,
      creation.requestId,
      'OWNER_EMAIL_ALREADY_REGISTERED',
      performance,
    )
    throw ownerAlreadyRegistered()
  }

  if (!owner) {
    try {
      owner = await measurePhase(
        performance,
        'owner_invitation',
        () =>
          repository.createOwnerInvitation(
            input.ownerEmail,
            input.ownerName,
            creation.requestId,
          ),
      )
    } catch (invitationError) {
      owner = await recoverInvitedOwner(
        input.ownerEmail,
        creation.requestId,
        repository,
        performance,
      )

      if (!owner) {
        const normalizedError = normalizeCreationError(invitationError)
        await recordFailure(
          repository,
          creation.requestId,
          normalizedError.code,
          performance,
        )
        throw normalizedError
      }
    }
  }

  try {
    const completed = await measurePhase(
      performance,
      'atomic_persistence',
      () => repository.completeCreation(creation.requestId, owner.id),
    )

    return buildResponse(completed)
  } catch (completionError) {
    return await recoverAfterCompletionFailure(
      creation.requestId,
      owner,
      completionError,
      repository,
      performance,
    )
  }
}

async function recoverInvitedOwner(
  email: string,
  requestId: string,
  repository: CreatePlatformClinicRepository,
  performance?: EdgePerformanceInstrumentation,
) {
  const recovered = await measurePhase(
    performance,
    'creation_recovery',
    () => repository.findOwnerByEmail(email),
  )

  if (!recovered) {
    return null
  }

  if (recovered.creationRequestId !== requestId) {
    await recordFailure(
      repository,
      requestId,
      'OWNER_EMAIL_ALREADY_REGISTERED',
      performance,
    )
    throw ownerAlreadyRegistered()
  }

  return recovered
}

async function recoverAfterCompletionFailure(
  requestId: string,
  owner: PlatformClinicAuthUser,
  completionError: unknown,
  repository: CreatePlatformClinicRepository,
  performance?: EdgePerformanceInstrumentation,
): Promise<CreatePlatformClinicResponse> {
  let recovered: PlatformClinicCreationRequest | null

  try {
    recovered = await measurePhase(
      performance,
      'creation_recovery',
      () => repository.getCreation(requestId),
    )
  } catch {
    throw unknownCreationState()
  }

  if (recovered?.status === 'completed') {
    return buildResponse(recovered)
  }

  if (
    !recovered ||
    recovered.status !== 'reserved' ||
    owner.creationRequestId !== requestId
  ) {
    throw unknownCreationState()
  }

  try {
    await measurePhase(
      performance,
      'rollback_owner',
      () => repository.deleteCreatedOwner(owner.id),
    )
  } catch {
    throw unknownCreationState()
  }

  const normalizedError = normalizeCreationError(completionError)
  await recordFailure(
    repository,
    requestId,
    normalizedError.code,
    performance,
  )
  throw normalizedError
}

async function recordFailure(
  repository: CreatePlatformClinicRepository,
  requestId: string,
  errorCode: string,
  performance?: EdgePerformanceInstrumentation,
) {
  try {
    await measurePhase(
      performance,
      'creation_failure_record',
      () => repository.failCreation(requestId, errorCode),
    )
  } catch {
    // A reserved request is safe to retry. Do not hide the original error.
  }
}

function buildResponse(
  creation: PlatformClinicCreationRequest,
): CreatePlatformClinicResponse {
  if (
    creation.status !== 'completed' ||
    !creation.clinicId ||
    !creation.ownerUserId ||
    !creation.activationStatus
  ) {
    throw unknownCreationState()
  }

  return {
    activation: { status: creation.activationStatus },
    clinic: {
      clinicId: creation.clinicId,
      clinicName: creation.clinicName,
      clinicStatus:
        creation.activationStatus === 'already_active'
          ? 'active'
          : 'pending_activation',
      ownerEmail: creation.ownerEmail,
      ownerName: creation.ownerName,
      planId: creation.planId,
      priceTier: creation.priceTier,
    },
  }
}

function normalizeCreationError(error: unknown) {
  if (error instanceof CreatePlatformClinicError) {
    return error
  }

  return new CreatePlatformClinicError(
    'CREATE_FAILED',
    'No pudimos preparar el consultorio. Intenta nuevamente.',
    500,
  )
}

function ownerAlreadyRegistered() {
  return new CreatePlatformClinicError(
    'OWNER_EMAIL_ALREADY_REGISTERED',
    'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.',
    409,
  )
}

function unknownCreationState() {
  return new CreatePlatformClinicError(
    'CREATE_STATE_UNKNOWN',
    'No pudimos confirmar el alta. Espera un momento e intenta nuevamente.',
    503,
  )
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function normalizeComparableName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function invalidPayload(message: string) {
  return new CreatePlatformClinicError('INVALID_PAYLOAD', message, 400)
}

function measurePhase<T>(
  performance: EdgePerformanceInstrumentation | undefined,
  phase: EdgePerformancePhase,
  operation: () => Promise<T>,
) {
  return performance?.measure(phase, operation) ?? operation()
}
