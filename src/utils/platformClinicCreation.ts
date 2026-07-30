import type { CreatePlatformClinicServiceResult } from '../services/platformAdminService'
import type { CreatePlatformClinicInput } from '../types/platform'
import {
  clientPerformanceInstrumentation,
  createClientPerformanceEvent,
  elapsedMilliseconds,
  type ClientPerformanceInstrumentation,
  type PerformanceOperationContext,
} from './performanceTelemetry'

interface SubmissionLock {
  current: boolean
}

export type PlatformClinicRefreshState =
  | 'error'
  | 'idle'
  | 'refreshing'
  | 'success'

interface PlatformClinicCreationOptions {
  instrumentation?: ClientPerformanceInstrumentation
  onRefreshStateChange?: (state: PlatformClinicRefreshState) => void
}

export async function createPlatformClinicAndRefresh(
  input: CreatePlatformClinicInput,
  createClinic: (
    input: CreatePlatformClinicInput,
    performanceContext?: PerformanceOperationContext,
  ) => Promise<CreatePlatformClinicServiceResult>,
  refreshClinics: () => Promise<unknown>,
  {
    instrumentation = clientPerformanceInstrumentation,
    onRefreshStateChange,
  }: PlatformClinicCreationOptions = {},
) {
  const operationId = instrumentation.createOperationId()
  const startedAt = instrumentation.now()
  const createStartedAt = instrumentation.now()
  let createRequestMs: number
  let result: CreatePlatformClinicServiceResult

  try {
    result = await createClinic(input, {
      instrumentation,
      operationId,
    })
    createRequestMs = elapsedMilliseconds(
      createStartedAt,
      instrumentation.now(),
    )
  } catch (error) {
    createRequestMs = elapsedMilliseconds(
      createStartedAt,
      instrumentation.now(),
    )
    recordCreationConfirmation(
      instrumentation,
      operationId,
      'error',
      createRequestMs,
      startedAt,
    )
    recordCreationFlow(
      instrumentation,
      operationId,
      'error',
      createRequestMs,
      0,
      startedAt,
    )
    throw error
  }

  const creationOutcome =
    result.data && !result.error ? 'success' : 'error'

  recordCreationConfirmation(
    instrumentation,
    operationId,
    creationOutcome,
    createRequestMs,
    startedAt,
  )

  if (creationOutcome === 'success') {
    onRefreshStateChange?.('refreshing')
    void refreshClinicListInBackground(
      refreshClinics,
      instrumentation,
      operationId,
      createRequestMs,
      startedAt,
      onRefreshStateChange,
    )
  } else {
    recordCreationFlow(
      instrumentation,
      operationId,
      'error',
      createRequestMs,
      0,
      startedAt,
    )
  }

  return result
}

async function refreshClinicListInBackground(
  refreshClinics: () => Promise<unknown>,
  instrumentation: ClientPerformanceInstrumentation,
  operationId: string,
  createRequestMs: number,
  startedAt: number,
  onRefreshStateChange?: (state: PlatformClinicRefreshState) => void,
) {
  const refreshStartedAt = instrumentation.now()
  let outcome: 'error' | 'success' = 'success'

  try {
    await refreshClinics()
  } catch {
    outcome = 'error'
  }

  const listRefreshMs = elapsedMilliseconds(
    refreshStartedAt,
    instrumentation.now(),
  )

  instrumentation.record(
    createClientPerformanceEvent({
      operation: 'create_platform_clinic_refresh',
      operationId,
      outcome,
      phases: {
        list_refresh: listRefreshMs,
      },
      totalMs: listRefreshMs,
    }),
  )
  recordCreationFlow(
    instrumentation,
    operationId,
    outcome,
    createRequestMs,
    listRefreshMs,
    startedAt,
  )
  onRefreshStateChange?.(outcome)
}

export async function submitPlatformClinicOnce(
  input: CreatePlatformClinicInput,
  submissionLock: SubmissionLock,
  createClinic: (
    input: CreatePlatformClinicInput,
  ) => Promise<CreatePlatformClinicServiceResult>,
) {
  if (submissionLock.current) {
    return null
  }

  submissionLock.current = true

  try {
    return await createClinic(input)
  } finally {
    submissionLock.current = false
  }
}

function recordCreationFlow(
  instrumentation: ClientPerformanceInstrumentation,
  operationId: string,
  outcome: 'error' | 'success',
  createRequestMs: number,
  listRefreshMs: number,
  startedAt: number,
) {
  instrumentation.record(
    createClientPerformanceEvent({
      operation: 'create_platform_clinic_flow',
      operationId,
      outcome,
      phases: {
        create_request: createRequestMs,
        list_refresh: listRefreshMs,
      },
      totalMs: elapsedMilliseconds(startedAt, instrumentation.now()),
    }),
  )
}

function recordCreationConfirmation(
  instrumentation: ClientPerformanceInstrumentation,
  operationId: string,
  outcome: 'error' | 'success',
  createRequestMs: number,
  startedAt: number,
) {
  instrumentation.record(
    createClientPerformanceEvent({
      operation: 'create_platform_clinic_confirmation',
      operationId,
      outcome,
      phases: {
        create_request: createRequestMs,
      },
      totalMs: elapsedMilliseconds(startedAt, instrumentation.now()),
    }),
  )
}
