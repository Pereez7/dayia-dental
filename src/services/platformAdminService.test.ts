import { describe, expect, it, vi } from 'vitest'

import {
  createPlatformClinicWithClient,
  invokeSubscriptionActionWithClient,
  listPlatformClinicsWithClient,
  mapPlatformClinicSummary,
} from './platformAdminService'

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
        ownerName: null,
        planId: null,
        planName: null,
        subscriptionStatus: 'corrupt' as never,
      }),
    ).toMatchObject({
      activeMembersCount: 0,
      clinicStatus: 'unknown',
      ownerEmail: null,
      ownerName: null,
      planId: null,
      planName: null,
      subscriptionStatus: 'unknown',
    })
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
      },
    }
    const client = createClient({ data: response, error: null })
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'basic' as const,
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
      }),
    ).resolves.toEqual({
      data: null,
      error: 'La creación real de consultorios está deshabilitada.',
    })
  })

  it.each([
    [400, 'INVALID_PAYLOAD', 'Ingresa un email válido.', 'Ingresa un email válido.'],
    [403, 'FORBIDDEN', 'detalle interno', 'No tienes permiso para crear consultorios.'],
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
        }),
      ).resolves.toEqual({ data: null, error: expectedMessage })
    },
  )
})
