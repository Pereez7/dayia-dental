export type PerformanceOutcome = 'error' | 'success'

export interface ClientPerformanceEvent {
  event: 'dayia.performance'
  operation: string
  operationId: string
  outcome: PerformanceOutcome
  phases: Record<string, number>
  source: 'frontend'
  totalMs: number
}

export interface ClientPerformanceInstrumentation {
  createOperationId: () => string
  now: () => number
  record: (event: ClientPerformanceEvent) => void
}

export interface PerformanceOperationContext {
  instrumentation?: ClientPerformanceInstrumentation
  operationId: string
}

interface CreateClientPerformanceEventInput {
  operation: string
  operationId: string
  outcome: PerformanceOutcome
  phases: Record<string, number>
  totalMs: number
}

export const clientPerformanceInstrumentation: ClientPerformanceInstrumentation =
  {
    createOperationId: () => globalThis.crypto.randomUUID(),
    now: () => globalThis.performance.now(),
    record: (event) => {
      if (import.meta.env.MODE !== 'test') {
        console.info('[dayia-performance]', JSON.stringify(event))
      }
    },
  }

export function createClientPerformanceEvent({
  operation,
  operationId,
  outcome,
  phases,
  totalMs,
}: CreateClientPerformanceEventInput): ClientPerformanceEvent {
  return {
    event: 'dayia.performance',
    operation,
    operationId,
    outcome,
    phases: Object.fromEntries(
      Object.entries(phases).map(([phase, duration]) => [
        phase,
        roundDuration(duration),
      ]),
    ),
    source: 'frontend',
    totalMs: roundDuration(totalMs),
  }
}

export function elapsedMilliseconds(startedAt: number, finishedAt: number) {
  return Math.max(0, finishedAt - startedAt)
}

function roundDuration(duration: number) {
  if (!Number.isFinite(duration)) {
    return 0
  }

  return Math.round(Math.max(0, duration) * 10) / 10
}
