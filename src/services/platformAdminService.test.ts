import { describe, expect, it, vi } from 'vitest'

import {
  correctPlatformClinicOwnerEmailWithClient,
  createPlatformClinicWithClient,
  invokeSubscriptionActionWithClient,
  listPlatformClinicsWithClient,
  mapPlatformClinicSummary,
  resendPlatformClinicInvitationWithClient,
} from './platformAdminService'
import type { ClientPerformanceEvent } from '../utils/performanceTelemetry'

const clinicResponse = {
  activeMembersCount: 3,
  blockedAt: null,
  clinicId: 'clinic-1',
  clinicName: '  Clínica Central  ',
  clinicStatus: 'active' as const,
  createdAt: '2026-07-01T10:00:00.000Z',
  currency: 'BOB',
  currentPeriodEndsAt: '2099-08-01T10:00:00.000Z',
  graceEndsAt: '2099-08-06T10:00:00.000Z',
  isLifetime: false,
  lastPaymentAt: null,
  monthlyPrice: null,
  founderMonthlyPrice: null,
  planMonthlyPrices: {},
  planFounderMonthlyPrices: {},
  priceTier: 'standard' as const,
  customMonthlyPrice: null,
  founderPriceLocked: false,
  scheduledPlanId: null,
  scheduledPlanStartsAt: null,
  ownerEmail: '  owner@clinic.test ',
  ownerInvitationSentAt: null,
  ownerMembershipStatus: 'active' as const,
  ownerName: '  Dra. Ana  ',
  planId: 'pro',
  planName: 'Pro',
  paymentStatus: 'trial',
  payments: [],
  paymentSubmissions: [],
  subscriptionStatus: 'trialing' as const,
  trialEndsAt: '2099-07-16T10:00:00.000Z',
}

function createClient(
  result: { data: unknown; error: unknown },
  accessToken = 'valid-token',
) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: accessToken ? { access_token: accessToken } : null },
        error: null,
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue(result),
    },
  }
}

describe('platform admin service', () => {
  it('registers payments through the protected Function with the current JWT', async () => {
    const client = createClient({ data: { paymentId: 'payment-1' }, error: null })
    const body = {
      amountPaid: 540,
      billingCycle: 'six_months' as const,
      clinicId: 'clinic-1',
      customDays: null,
      discountPercent: 10,
      isLifetime: false,
      notes: '',
      paidAt: '2026-07-20T12:00:00.000Z',
      planId: 'basic' as const,
      reference: 'QR-100',
    }

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'register-subscription-payment',
        body,
      ),
    ).resolves.toEqual({ error: null, success: true })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'register-subscription-payment',
      {
        body,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })
  it('sends founder pricing changes only through the protected Function', async () => {
    const client = createClient({ data: { success: true }, error: null })
    const body = {
      action: 'set_founder_price' as const,
      clinicId: 'clinic-1',
      notes: 'Beneficio comercial aprobado',
    }

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'update-clinic-subscription',
        body,
      ),
    ).resolves.toEqual({ error: null, success: true })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'update-clinic-subscription',
      {
        body,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('updates lifetime membership only through the protected Function', async () => {
    const client = createClient({ data: { enabled: true }, error: null })
    const body = {
      action: 'enable_lifetime' as const,
      clinicId: 'clinic-1',
      notes: 'Beneficio comercial aprobado.',
    }

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'update-clinic-subscription',
        body,
      ),
    ).resolves.toEqual({ error: null, success: true })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'update-clinic-subscription',
      {
        body,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('rejects a payment notice through the protected Function with its reason', async () => {
    const client = createClient({
      data: { status: 'rejected', submissionId: 'submission-1' },
      error: null,
    })
    const body = {
      reason: 'El importe no coincide con el comprobante.',
      submissionId: 'submission-1',
    }

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'reject-subscription-payment-submission',
        body,
      ),
    ).resolves.toEqual({ error: null, success: true })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'reject-subscription-payment-submission',
      {
        body,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('preserves the safe conflict message when a later subscription change blocks a void', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'SUBSCRIPTION_CHANGED_AFTER_PAYMENT',
        message:
          'La suscripción tuvo cambios posteriores que no se pueden restaurar automáticamente. Revisa el historial antes de anular.',
      }),
      { status: 409 },
    )
    const client = createClient({
      data: null,
      error: { context: response, status: 409 },
    })

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'void-subscription-payment',
        {
          paymentId: 'payment-1',
          reason: 'Pago registrado para una prueba.',
        },
      ),
    ).resolves.toEqual({
      error:
        'La suscripción tuvo cambios posteriores que no se pueden restaurar automáticamente. Revisa el historial antes de anular.',
      success: false,
    })
  })

  it('converts a network exception into a visible subscription error', async () => {
    const client = createClient({ data: null, error: null })
    client.functions.invoke.mockRejectedValueOnce(new Error('Network failure'))

    await expect(
      invokeSubscriptionActionWithClient(
        client,
        'void-subscription-payment',
        {
          paymentId: 'payment-1',
          reason: 'Pago registrado para una prueba.',
        },
      ),
    ).resolves.toEqual({
      error:
        'No pudimos comunicarnos con el servicio de suscripciones. Intenta nuevamente.',
      success: false,
    })
  })

  it('loads clinics and sends the current JWT', async () => {
    const client = createClient({
      data: { clinics: [clinicResponse] },
      error: null,
    })

    const result = await listPlatformClinicsWithClient(client)

    expect(result.error).toBeNull()
    expect(result.data).toEqual([
      {
        ...clinicResponse,
        clinicName: 'Clínica Central',
        ownerEmail: 'owner@clinic.test',
        ownerName: 'Dra. Ana',
      },
    ])
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'list-platform-clinics',
      {
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('resends a pending owner invitation through the protected Function', async () => {
    const response = {
      email: 'owner@clinic.test',
      sentAt: '2026-07-27T22:10:00.000Z',
    }
    const client = createClient({ data: response, error: null })

    await expect(
      resendPlatformClinicInvitationWithClient(
        client,
        '59df9ac5-b22a-47c4-9078-983f286b2d75',
      ),
    ).resolves.toEqual({ data: response, error: null })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'resend-platform-clinic-invitation',
      {
        body: { clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75' },
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('corrects a pending owner email and sends the current JWT', async () => {
    const response = {
      email: 'corrected.owner@clinic.test',
      sentAt: '2026-07-30T22:10:00.000Z',
    }
    const client = createClient({ data: response, error: null })
    const input = {
      clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
      ownerEmail: 'corrected.owner@clinic.test',
    }

    await expect(
      correctPlatformClinicOwnerEmailWithClient(client, input),
    ).resolves.toEqual({ data: response, error: null })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'correct-platform-clinic-owner-email',
      {
        body: input,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('shows the duplicate email reason returned by the correction Function', async () => {
    const message =
      'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.'
    const client = createClient({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            code: 'OWNER_EMAIL_ALREADY_REGISTERED',
            message,
          }),
          { status: 409 },
        ),
        status: 409,
      },
    })

    await expect(
      correctPlatformClinicOwnerEmailWithClient(client, {
        clinicId: '59df9ac5-b22a-47c4-9078-983f286b2d75',
        ownerEmail: 'existing@clinic.test',
      }),
    ).resolves.toEqual({ data: null, error: message })
  })

  it('shows the safe cooldown message returned by the invitation Function', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'INVITATION_RATE_LIMITED',
        message: 'Espera 45 segundos antes de reenviar otra invitación.',
      }),
      { status: 429 },
    )
    const client = createClient({
      data: null,
      error: { context: response, status: 429 },
    })

    await expect(
      resendPlatformClinicInvitationWithClient(
        client,
        '59df9ac5-b22a-47c4-9078-983f286b2d75',
      ),
    ).resolves.toEqual({
      data: null,
      error: 'Espera 45 segundos antes de reenviar otra invitación.',
    })
  })

  it('returns a public message for a 403 response', async () => {
    const client = createClient({
      data: null,
      error: { context: { status: 403 } },
    })

    await expect(listPlatformClinicsWithClient(client)).resolves.toEqual({
      data: null,
      error: 'No tienes permiso para ver los consultorios.',
    })
  })

  it('keeps an empty response as a successful empty list', async () => {
    const client = createClient({ data: { clinics: [] }, error: null })

    await expect(listPlatformClinicsWithClient(client)).resolves.toEqual({
      data: [],
      error: null,
    })
  })

  it('maps nullable fields and unknown statuses safely', () => {
    expect(
      mapPlatformClinicSummary({
        ...clinicResponse,
        activeMembersCount: -4,
        clinicStatus: 'corrupt' as never,
        ownerEmail: null,
        ownerInvitationSentAt: null,
        ownerMembershipStatus: null,
        ownerName: null,
        planId: null,
        planName: null,
        subscriptionStatus: 'corrupt' as never,
      }),
    ).toMatchObject({
      activeMembersCount: 0,
      clinicStatus: 'unknown',
      ownerEmail: null,
      ownerInvitationSentAt: null,
      ownerMembershipStatus: null,
      ownerName: null,
      planId: null,
      planName: null,
      subscriptionStatus: 'unknown',
    })
  })

  it('keeps a blocked lifetime clinic visibly blocked', () => {
    expect(
      mapPlatformClinicSummary({
        ...clinicResponse,
        isLifetime: true,
        subscriptionStatus: 'blocked',
      }).subscriptionStatus,
    ).toBe('blocked')
  })

  it('uses canonical labels for known plans', () => {
    expect(
      mapPlatformClinicSummary({
        ...clinicResponse,
        planId: 'basic',
        planName: 'basic',
      }).planName,
    ).toBe('Basic')
  })

  it('creates a clinic through the Function and sends the current JWT', async () => {
    const response = {
      activation: { status: 'pending' },
      clinic: {
        clinicId: 'clinic-new',
        clinicName: 'Clínica Norte',
        clinicStatus: 'pending_activation',
        ownerEmail: 'owner@example.com',
        ownerName: 'Dra. Andrea',
        planId: 'basic',
        priceTier: 'standard',
      },
    }
    const client = createClient({ data: response, error: null })
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'basic' as const,
      priceTier: 'standard' as const,
    }

    await expect(createPlatformClinicWithClient(client, input)).resolves.toEqual({
      data: response,
      error: null,
    })
    expect(client.functions.invoke).toHaveBeenCalledWith(
      'create-platform-clinic',
      {
        body: input,
        headers: { Authorization: 'Bearer valid-token' },
        method: 'POST',
      },
    )
  })

  it('correlates and measures the protected creation request without personal data', async () => {
    const response = {
      activation: { status: 'pending' },
      clinic: {
        clinicId: 'clinic-new',
        clinicName: 'Clínica Norte',
        clinicStatus: 'pending_activation',
        ownerEmail: 'owner@example.com',
        ownerName: 'Dra. Andrea',
        planId: 'basic',
        priceTier: 'standard',
      },
    }
    const client = createClient({ data: response, error: null })
    const timestamps = [0, 1, 3, 4, 14, 15]
    const events: ClientPerformanceEvent[] = []
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'basic' as const,
      priceTier: 'standard' as const,
    }

    await createPlatformClinicWithClient(client, input, {
      instrumentation: {
        createOperationId: () => 'operation-123',
        now: () => timestamps.shift() ?? 15,
        record: (event) => events.push(event),
      },
      operationId: 'operation-123',
    })

    expect(client.functions.invoke).toHaveBeenCalledWith(
      'create-platform-clinic',
      {
        body: input,
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Dayia-Operation-Id': 'operation-123',
        },
        method: 'POST',
      },
    )
    expect(events).toEqual([
      {
        event: 'dayia.performance',
        operation: 'create_platform_clinic_request',
        operationId: 'operation-123',
        outcome: 'success',
        phases: {
          function_invoke: 10,
          session: 2,
        },
        source: 'frontend',
        totalMs: 15,
      },
    ])
    expect(JSON.stringify(events)).not.toContain('owner@example.com')
    expect(JSON.stringify(events)).not.toContain('Clínica Norte')
    expect(JSON.stringify(events)).not.toContain('valid-token')
  })

  it('maps the disabled creation response without technical text', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'PLATFORM_CREATE_DISABLED',
        message: 'La creación real de consultorios está deshabilitada.',
      }),
      { status: 409 },
    )
    const client = createClient({
      data: null,
      error: { context: response, status: 409 },
    })

    await expect(
      createPlatformClinicWithClient(client, {
        clinicName: 'Clínica Norte',
        ownerEmail: 'owner@example.com',
        ownerName: 'Dra. Andrea',
        planId: 'basic',
        priceTier: 'standard',
      }),
    ).resolves.toEqual({
      data: null,
      error: 'La creación real de consultorios está deshabilitada.',
    })
  })

  it('shows the duplicate owner email reason during clinic creation', async () => {
    const message =
      'Este correo ya está registrado en DayIA Dental y no puede usarse para otro consultorio.'
    const client = createClient({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            code: 'OWNER_EMAIL_ALREADY_REGISTERED',
            message,
          }),
          { status: 409 },
        ),
        status: 409,
      },
    })

    await expect(
      createPlatformClinicWithClient(client, {
        clinicName: 'Clínica Duplicada',
        ownerEmail: 'existing@clinic.test',
        ownerName: 'Dra. Existente',
        planId: 'basic',
        priceTier: 'standard',
      }),
    ).resolves.toEqual({ data: null, error: message })
  })

  it.each([
    [400, 'INVALID_PAYLOAD', 'Ingresa un email válido.', 'Ingresa un email válido.'],
    [403, 'FORBIDDEN', 'detalle interno', 'No tienes permiso para crear consultorios.'],
    [409, 'FOUNDER_PRICE_NOT_CONFIGURED', 'La tarifa fundador no está configurada para el plan seleccionado.', 'La tarifa fundador no está configurada para el plan seleccionado.'],
    [409, 'UNKNOWN_CONFLICT', 'detalle interno', 'No pudimos crear el consultorio por un conflicto.'],
    [500, 'UNEXPECTED_ERROR', 'stack trace', 'No pudimos preparar el consultorio. Intenta nuevamente.'],
  ])(
    'maps a %i creation error to safe copy',
    async (status, code, message, expectedMessage) => {
      const client = createClient({
        data: null,
        error: {
          context: new Response(JSON.stringify({ code, message }), { status }),
          status,
        },
      })

      await expect(
        createPlatformClinicWithClient(client, {
          clinicName: 'Clínica Norte',
          ownerEmail: 'owner@example.com',
          ownerName: 'Dra. Andrea',
          planId: 'basic',
          priceTier: 'standard',
        }),
      ).resolves.toEqual({ data: null, error: expectedMessage })
    },
  )
})
