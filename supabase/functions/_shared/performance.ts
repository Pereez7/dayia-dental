export type EdgePerformancePhase =
  | 'auth_user'
  | 'atomic_persistence'
  | 'clinic_insert'
  | 'creation_failure_record'
  | 'creation_preflight'
  | 'creation_recovery'
  | 'duplicate_check'
  | 'membership_insert'
  | 'owner_invitation'
  | 'owner_lookup'
  | 'owner_profile_update'
  | 'payload_validation'
  | 'platform_authorization'
  | 'rollback_clinic'
  | 'rollback_owner'
  | 'subscription_insert'

export interface EdgePerformanceInstrumentation {
  measure: <T>(
    phase: EdgePerformancePhase,
    operation: () => Promise<T>,
  ) => Promise<T>
}

export interface EdgePerformanceLog {
  event: 'dayia.performance'
  operation: string
  operationId: string
  outcome: 'error' | 'success'
  phases: Partial<Record<EdgePerformancePhase, number>>
  source: 'edge-function'
  status: number
  totalMs: number
}

export interface EdgePerformanceSnapshot {
  log: EdgePerformanceLog
  serverTiming: string
}

const operationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolvePerformanceOperationId(
  candidate: string | null,
  createId = () => crypto.randomUUID(),
) {
  const normalized = candidate?.trim() ?? ''

  return operationIdPattern.test(normalized) ? normalized : createId()
}

export function createEdgePerformanceRecorder(
  operation: string,
  operationId: string,
  now = () => performance.now(),
): EdgePerformanceInstrumentation & {
  complete: (status: number) => EdgePerformanceSnapshot
} {
  const startedAt = now()
  const phaseDurations = new Map<EdgePerformancePhase, number>()

  return {
    async measure<T>(
      phase: EdgePerformancePhase,
      measuredOperation: () => Promise<T>,
    ) {
      const phaseStartedAt = now()

      try {
        return await measuredOperation()
      } finally {
        const duration = elapsedMilliseconds(phaseStartedAt, now())
        phaseDurations.set(
          phase,
          (phaseDurations.get(phase) ?? 0) + duration,
        )
      }
    },
    complete(status) {
      const totalMs = roundDuration(elapsedMilliseconds(startedAt, now()))
      const phases = Object.fromEntries(
        [...phaseDurations.entries()].map(([phase, duration]) => [
          phase,
          roundDuration(duration),
        ]),
      ) as Partial<Record<EdgePerformancePhase, number>>
      const serverTiming = [
        ...Object.entries(phases).map(
          ([phase, duration]) => `${phase};dur=${duration}`,
        ),
        `total;dur=${totalMs}`,
      ].join(', ')

      return {
        log: {
          event: 'dayia.performance',
          operation,
          operationId,
          outcome: status >= 200 && status < 400 ? 'success' : 'error',
          phases,
          source: 'edge-function',
          status,
          totalMs,
        },
        serverTiming,
      }
    },
  }
}

function elapsedMilliseconds(startedAt: number, finishedAt: number) {
  return Math.max(0, finishedAt - startedAt)
}

function roundDuration(duration: number) {
  if (!Number.isFinite(duration)) {
    return 0
  }

  return Math.round(Math.max(0, duration) * 10) / 10
}
