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

export async function createPlatformClinicAndRefresh(
  input: CreatePlatformClinicInput,
  createClinic: (
    input: CreatePlatformClinicInput,
    performanceContext?: PerformanceOperationContext,
  ) => Promise<CreatePlatformClinicServiceResult>,
  refreshClinics: () => Promise<unknown>,
  instrumentation: ClientPerformanceInstrumentation =
    clientPerformanceInstrumentation,
) {
  const operationId = instrumentation.createOperationId()
  const startedAt = instrumentation.now()
  const createStartedAt = instrumentation.now()
  let createRequestMs: number
  let listRefreshMs = 0
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
    recordCreationFlow(
      instrumentation,
      operationId,
      'error',
      createRequestMs,
      listRefreshMs,
      startedAt,
    )
    throw error
  }

  if (result.data && !result.error) {
    const refreshStartedAt = instrumentation.now()

    try {
      await refreshClinics()
    } catch (error) {
      listRefreshMs = elapsedMilliseconds(
        refreshStartedAt,
        instrumentation.now(),
      )
      recordCreationFlow(
        instrumentation,
        operationId,
        'error',
        createRequestMs,
        listRefreshMs,
        startedAt,
      )
      throw error
    }

    listRefreshMs = elapsedMilliseconds(
      refreshStartedAt,
      instrumentation.now(),
    )
  }

  recordCreationFlow(
    instrumentation,
    operationId,
    result.data && !result.error ? 'success' : 'error',
    createRequestMs,
    listRefreshMs,
    startedAt,
  )

  return result
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
