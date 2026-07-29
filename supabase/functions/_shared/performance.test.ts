import { describe, expect, it, vi } from 'vitest'

import {
  createEdgePerformanceRecorder,
  resolvePerformanceOperationId,
} from './performance'

describe('Edge Function performance telemetry', () => {
  it('records phase and total timings without request data', async () => {
    const timestamps = [0, 10, 35, 40]
    const recorder = createEdgePerformanceRecorder(
      'create_platform_clinic',
      '123e4567-e89b-42d3-a456-426614174000',
      vi.fn(() => timestamps.shift() ?? 40),
    )

    await recorder.measure('platform_authorization', async () => undefined)
    const snapshot = recorder.complete(201)

    expect(snapshot).toEqual({
      log: {
        event: 'dayia.performance',
        operation: 'create_platform_clinic',
        operationId: '123e4567-e89b-42d3-a456-426614174000',
        outcome: 'success',
        phases: {
          platform_authorization: 25,
        },
        source: 'edge-function',
        status: 201,
        totalMs: 40,
      },
      serverTiming: 'platform_authorization;dur=25, total;dur=40',
    })
    expect(JSON.stringify(snapshot)).not.toContain('email')
    expect(JSON.stringify(snapshot)).not.toContain('clinicName')
    expect(JSON.stringify(snapshot)).not.toContain('token')
  })

  it('sums repeated phases and marks error responses', async () => {
    const timestamps = [0, 2, 7, 10, 18, 20]
    const recorder = createEdgePerformanceRecorder(
      'create_platform_clinic',
      '123e4567-e89b-42d3-a456-426614174000',
      () => timestamps.shift() ?? 20,
    )

    await recorder.measure('owner_lookup', async () => undefined)
    await recorder.measure('owner_lookup', async () => undefined)

    expect(recorder.complete(409).log).toMatchObject({
      outcome: 'error',
      phases: { owner_lookup: 13 },
      status: 409,
      totalMs: 20,
    })
  })

  it('rejects personal or malformed correlation identifiers', () => {
    expect(
      resolvePerformanceOperationId(
        'owner@example.com',
        () => 'generated-operation',
      ),
    ).toBe('generated-operation')
    expect(
      resolvePerformanceOperationId(
        '123e4567-e89b-42d3-a456-426614174000',
        () => 'generated-operation',
      ),
    ).toBe('123e4567-e89b-42d3-a456-426614174000')
  })
})
