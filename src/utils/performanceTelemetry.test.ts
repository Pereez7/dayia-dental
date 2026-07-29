import { describe, expect, it, vi } from 'vitest'

import {
  createClientPerformanceEvent,
  elapsedMilliseconds,
  type ClientPerformanceInstrumentation,
} from './performanceTelemetry'

describe('performance telemetry', () => {
  it('formats anonymous frontend timings with stable precision', () => {
    expect(
      createClientPerformanceEvent({
        operation: 'create_platform_clinic_flow',
        operationId: 'operation-123',
        outcome: 'success',
        phases: {
          create_request: 1250.267,
          list_refresh: 423.044,
        },
        totalMs: 1673.311,
      }),
    ).toEqual({
      event: 'dayia.performance',
      operation: 'create_platform_clinic_flow',
      operationId: 'operation-123',
      outcome: 'success',
      phases: {
        create_request: 1250.3,
        list_refresh: 423,
      },
      source: 'frontend',
      totalMs: 1673.3,
    })
  })

  it('never reports negative or invalid durations', () => {
    expect(elapsedMilliseconds(20, 10)).toBe(0)
    expect(
      createClientPerformanceEvent({
        operation: 'test',
        operationId: 'operation-123',
        outcome: 'error',
        phases: { request: Number.NaN, refresh: -5 },
        totalMs: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({
      phases: { request: 0, refresh: 0 },
      totalMs: 0,
    })
  })

  it('supports a deterministic recorder without personal data fields', () => {
    const events: unknown[] = []
    const instrumentation: ClientPerformanceInstrumentation = {
      createOperationId: () => 'operation-123',
      now: vi.fn(() => 100),
      record: (event) => events.push(event),
    }

    instrumentation.record(
      createClientPerformanceEvent({
        operation: 'create_platform_clinic_request',
        operationId: instrumentation.createOperationId(),
        outcome: 'success',
        phases: { function_invoke: 80 },
        totalMs: 100,
      }),
    )

    const serialized = JSON.stringify(events)
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('clinicName')
    expect(serialized).not.toContain('token')
  })
})
