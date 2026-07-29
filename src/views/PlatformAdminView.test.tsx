import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type {
  PlatformClinicSummary,
  PlatformSubscriptionPayment,
} from '../types/platform'
import {
  ClinicOnboardingFeedback,
  ClinicOnboardingForm,
} from '../components/ClinicOnboardingForm'
import {
  ExtraDaysReview,
  LifetimeMembershipReview,
  PlanChangeReviewSummary,
  ReactivationReview,
  SubscriptionAdministration,
} from '../components/SubscriptionAdministration'
import {
  getPaymentHistoryPaginationItems,
  paginatePaymentHistory,
} from '../utils/paymentHistoryPagination'
import {
  createPlatformClinicAndRefresh,
  submitPlatformClinicOnce,
} from '../utils/platformClinicCreation'
import type { ClientPerformanceEvent } from '../utils/performanceTelemetry'
import {
  PlatformAdminView,
  PlatformClinicsContent,
  PlatformPaymentOverview,
} from './PlatformAdminView'

const clinic: PlatformClinicSummary = {
  activeMembersCount: 2,
  blockedAt: null,
  clinicId: 'clinic-1',
  clinicName: 'Clínica Central',
  clinicStatus: 'active',
  createdAt: '2026-07-01T10:00:00.000Z',
  currency: 'BOB',
  currentPeriodEndsAt: '2026-08-01T10:00:00.000Z',
  graceEndsAt: '2026-08-06T10:00:00.000Z',
  isLifetime: false,
  lastPaymentAt: null,
  monthlyPrice: null,
  founderMonthlyPrice: null,
  planMonthlyPrices: {},
  planFounderMonthlyPrices: {},
  priceTier: 'standard',
  customMonthlyPrice: null,
  founderPriceLocked: false,
  scheduledPlanId: null,
  scheduledPlanStartsAt: null,
  ownerEmail: 'ana@clinic.test',
  ownerInvitationSentAt: null,
  ownerMembershipStatus: 'active',
  ownerName: 'Dra. Ana Pérez',
  planId: 'medium',
  planName: 'Medium',
  paymentStatus: 'paid',
  payments: [],
  paymentSubmissions: [],
  subscriptionStatus: 'active',
  trialEndsAt: null,
}

function createPayment(index: number): PlatformSubscriptionPayment {
  return {
    amountDue: 249 + index,
    amountPaid: 249 + index,
    billingCycle: 'monthly',
    createdAt: `2026-07-${String(24 - index).padStart(2, '0')}T19:06:00.000Z`,
    currency: 'BOB',
    customDays: null,
    discountAmount: 0,
    discountPercent: 0,
    id: `payment-${index}`,
    monthsCovered: 1,
    newPlanId: null,
    notes: null,
    paidAt: `2026-07-${String(24 - index).padStart(2, '0')}T19:06:00.000Z`,
    paymentType: 'regular',
    periodEndsAt: null,
    periodStartsAt: null,
    planId: 'pro',
    previousPlanId: null,
    priceTier: 'standard',
    recordedBy: 'Charles Pérez',
    reference: `REF-${index}`,
    status: index === 0 ? 'registered' : 'voided',
    voidedAt: index === 0 ? null : '2026-07-25T10:00:00.000Z',
    voidedBy: index === 0 ? null : 'Charles Pérez',
    voidReason: index === 0 ? null : 'Registro de prueba anulado',
  }
}

describe('PlatformAdminView', () => {
  it('renders the loading state', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[]}
        errorMessage=""
        isLoading
      />,
    )

    expect(markup).toContain('Cargando consultorios')
  })

  it('renders the empty state', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[]}
        errorMessage=""
        isLoading={false}
      />,
    )

    expect(markup).toContain('Aún no hay consultorios registrados')
  })

  it('renders only the administrative clinic summary', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[clinic]}
        errorMessage=""
        isLoading={false}
      />,
    )

    expect(markup).toContain('Clínica Central')
    expect(markup).toContain('Dra. Ana Pérez')
    expect(markup).toContain('ana@clinic.test')
    expect(markup).toContain('Medium')
    expect(markup).toContain('Activa')
    expect(markup).toContain('2')
    expect(markup).not.toContain('Sin estado')
    expect(markup).not.toContain('Pacientes')
    expect(markup).not.toContain('Citas')
    expect(markup).not.toContain('Historial clínico')
  })

  it('renders a clinic without an active owner', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[{ ...clinic, ownerEmail: null, ownerName: null }]}
        errorMessage=""
        isLoading={false}
      />,
    )

    expect(markup).toContain('Sin propietario')
    expect(markup).not.toContain('Sin email registrado')
  })

  it('shows the pending owner and the invitation resend action', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[
          {
            ...clinic,
            activeMembersCount: 0,
            clinicStatus: 'pending_activation',
            ownerInvitationSentAt: '2026-07-27T21:07:27.000Z',
            ownerMembershipStatus: 'pending_activation',
          },
        ]}
        errorMessage=""
        isLoading={false}
        onResendInvitation={vi.fn()}
      />,
    )

    expect(markup).toContain('Dra. Ana Pérez')
    expect(markup).toContain('ana@clinic.test')
    expect(markup).toContain('Invitación pendiente')
    expect(markup).toContain('Reenviar invitación')
    expect(markup).not.toContain('Sin propietario')
  })

  it('marks the affected clinic with a compact payment-review badge', () => {
    const markup = renderToStaticMarkup(
      <PlatformClinicsContent
        clinics={[
          {
            ...clinic,
            paymentSubmissions: [
              {
                amountExpected: 249,
                billingCycle: 'monthly',
                createdAt: '2026-07-23T14:00:00.000Z',
                currency: 'BOB',
                id: 'notice-1',
                notes: null,
                planId: 'pro',
                reference: 'dayia-whatsapp',
                status: 'pending_review',
                submittedBy: 'Dra. Ana Pérez',
              },
            ],
          },
        ]}
        errorMessage=""
        isLoading={false}
        onManage={vi.fn()}
      />,
    )

    expect(markup).toContain('Revisar pago')
    expect(markup).toContain('Gestionar cobro')
    expect(markup).not.toContain('aviso de pago por revisar')
  })

  it('summarizes many payment notices without listing clinic names', () => {
    const markup = renderToStaticMarkup(
      <PlatformPaymentOverview count={10} />,
    )

    expect(markup).toContain('<strong>10</strong>')
    expect(markup).toContain('pagos por revisar')
    expect(markup).not.toContain('Clínica Central')
  })

  it('keeps the administrative payment form focused on verification data', () => {
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={{
          ...clinic,
          planMonthlyPrices: { medium: 199 },
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toContain('Registrar pago')
    expect(markup.match(/Plan actual/g)).toHaveLength(1)
    expect(markup).not.toContain('QR de cobro')
    expect(markup).not.toContain('Tipo de precio')
    expect(markup).not.toContain('Enter no registra el pago')
    expect(markup).not.toContain('field-message--reserved')
    expect(markup).toMatch(
      /subscription-field-wrapper subscription-field-wide[^>]*><label>Referencia/,
    )
    expect(markup).toContain('Revisar aumento')
    expect(markup).not.toContain('>Aumentar días<')
    expect(markup).toContain('Asignar membresía vitalicia')
  })

  it('reviews the effect of extra days before applying them', () => {
    const markup = renderToStaticMarkup(
      <ExtraDaysReview
        clinic={clinic}
        days={2}
        graceEndsAt="2026-08-15T10:00:00.000Z"
        periodEndsAt="2026-08-10T10:00:00.000Z"
      />,
    )

    expect(markup).toContain('Clínica Central')
    expect(markup).toContain('2 días')
    expect(markup).toContain('Vencimiento actual')
    expect(markup).toContain('Nuevo vencimiento')
    expect(markup).toContain('Nueva gracia hasta')
  })

  it('explains a reversible lifetime membership before assigning it', () => {
    const markup = renderToStaticMarkup(
      <LifetimeMembershipReview action="enable" clinic={clinic} />,
    )

    expect(markup).toContain('Clínica Central')
    expect(markup).toContain('Plan que conserva')
    expect(markup).toContain('Acceso sin vencimiento')
    expect(markup).toContain('Vencimiento actual')
  })

  it('summarizes the impact of an immediate plan exception', () => {
    const markup = renderToStaticMarkup(
      <PlanChangeReviewSummary
        clinic={{ ...clinic, planId: 'pro', planName: 'Pro' }}
        immediate
        planId="medium"
      />,
    )

    expect(markup).toContain('Plan actual')
    expect(markup).toContain('Pro')
    expect(markup).toContain('Nuevo plan')
    expect(markup).toContain('Medium')
    expect(markup).toContain('Inmediatamente')
  })

  it('offers removal and disables extra days while lifetime is active', () => {
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={{
          ...clinic,
          currentPeriodEndsAt: null,
          graceEndsAt: null,
          isLifetime: true,
          subscriptionStatus: 'lifetime',
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toContain('Activa · acceso sin vencimiento')
    expect(markup).toContain('Retirar membresía vitalicia')
    expect(markup).toContain(
      'Retira primero la membresía vitalicia para asignar una vigencia',
    )
    expect(markup).toMatch(/Días adicionales<input[^>]*disabled/)
  })

  it('disables reactivation while access is already enabled', () => {
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={clinic}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toContain('Acceso habilitado')
    expect(markup).toMatch(
      /class="secondary-action" disabled=""[^>]*>Acceso habilitado/,
    )
    expect(markup).toMatch(
      /class="danger-action"[^>]*>Bloquear consultorio/,
    )
  })

  it('enables reactivation only for a blocked subscription', () => {
    const blockedClinic = {
      ...clinic,
      blockedAt: '2026-07-26T12:00:00.000Z',
      subscriptionStatus: 'blocked' as const,
    }
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={blockedClinic}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toMatch(
      /class="secondary-action"[^>]*>Reactivar acceso/,
    )
    expect(markup).not.toMatch(
      /class="secondary-action" disabled=""[^>]*>Reactivar acceso/,
    )
    expect(markup).toMatch(
      /class="danger-action" disabled=""[^>]*>Consultorio bloqueado/,
    )

    const review = renderToStaticMarkup(
      <ReactivationReview clinic={blockedClinic} />,
    )
    expect(review).toContain('Estado actual')
    expect(review).toContain('Bloqueado')
    expect(review).toContain('Según vigencia actual')
  })

  it('offers a separate rejection action for pending payment notices', () => {
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={{
          ...clinic,
          paymentSubmissions: [
            {
              amountExpected: 199,
              billingCycle: 'monthly',
              createdAt: '2026-07-23T12:00:00.000Z',
              currency: 'BOB',
              id: 'submission-1',
              notes: null,
              planId: 'medium',
              reference: 'dayia-whatsapp',
              status: 'pending_review',
              submittedBy: 'Dra. Ana Pérez',
            },
          ],
          planMonthlyPrices: { medium: 199 },
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toContain('Revisar solicitud')
    expect(markup).toContain('Rechazar solicitud')
  })

  it('shows only five recent payments on the first history page', () => {
    const payments = Array.from({ length: 12 }, (_, index) =>
      createPayment(index),
    )
    const markup = renderToStaticMarkup(
      <SubscriptionAdministration
        clinic={{ ...clinic, payments }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(markup).toContain('Mostrando')
    expect(markup).toContain('de <strong>12</strong> pagos')
    expect(markup).toContain('249.00 BOB')
    expect(markup).toContain('253.00 BOB')
    expect(markup).not.toContain('254.00 BOB')
    expect(markup).toContain('Paginación del historial de pagos')
    expect(markup).toContain('Página 1 de 3')
  })

  it('paginates and clamps the payment history safely', () => {
    const payments = Array.from({ length: 12 }, (_, index) =>
      createPayment(index),
    )

    const secondPage = paginatePaymentHistory(payments, 2)
    const pageAfterLast = paginatePaymentHistory(payments, 99)

    expect(secondPage.items.map((payment) => payment.id)).toEqual([
      'payment-5',
      'payment-6',
      'payment-7',
      'payment-8',
      'payment-9',
    ])
    expect(secondPage.startIndex).toBe(5)
    expect(secondPage.endIndex).toBe(10)
    expect(pageAfterLast.currentPage).toBe(3)
    expect(pageAfterLast.items.map((payment) => payment.id)).toEqual([
      'payment-10',
      'payment-11',
    ])
  })

  it('keeps long payment pagination compact', () => {
    expect(getPaymentHistoryPaginationItems(8, 20)).toEqual([
      1,
      'ellipsis-start',
      7,
      8,
      9,
      'ellipsis-end',
      20,
    ])
  })

  it('denies access without starting the platform loader', () => {
    const loadClinics = vi.fn().mockResolvedValue({ data: [], error: null })
    const markup = renderToStaticMarkup(
      <PlatformAdminView
        canAccessPlatformAdmin={false}
        loadClinics={loadClinics}
      />,
    )

    expect(markup).toContain('Acceso no autorizado')
    expect(markup).not.toContain('Alta segura de consultorios')
    expect(loadClinics).not.toHaveBeenCalled()
  })

  it('renders the form connected to the creation flow', () => {
    const markup = renderToStaticMarkup(
      <ClinicOnboardingForm onCreate={vi.fn()} />,
    )

    expect(markup).toContain('Preparar consultorio')
    expect(markup).toContain('15 días de prueba')
    expect(markup).toContain('Tarifa estándar')
    expect(markup).toContain('Tarifa fundador')
    expect(markup).toContain('Plan completo')
    expect(markup).toContain(
      'Revisa los datos antes de preparar el consultorio.',
    )
    expect(markup).not.toContain('Modo de validación')
    expect(markup).not.toContain('Validar alta')
  })

  it('renders the disabled response from the Function', () => {
    const markup = renderToStaticMarkup(
      <ClinicOnboardingFeedback
        errorMessage="La creación real de consultorios está deshabilitada."
        successMessage=""
      />,
    )

    expect(markup).toContain('La creación real sigue deshabilitada.')
    expect(markup).toContain(
      'La creación real de consultorios está deshabilitada.',
    )
    expect(markup).toContain('role="alert"')
  })

  it('renders the successful creation message', () => {
    const markup = renderToStaticMarkup(
      <ClinicOnboardingFeedback
        errorMessage=""
        successMessage="Consultorio preparado correctamente."
      />,
    )

    expect(markup).toContain('Consultorio preparado correctamente.')
    expect(markup).toContain('role="status"')
  })

  it('refreshes the list only after a successful creation', async () => {
    const createClinic = vi.fn().mockResolvedValue({
      data: {
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
      },
      error: null,
    })
    const refreshClinics = vi.fn().mockResolvedValue({ data: [], error: null })
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'basic' as const,
      priceTier: 'standard' as const,
    }

    await createPlatformClinicAndRefresh(input, createClinic, refreshClinics)

    expect(refreshClinics).toHaveBeenCalledOnce()
  })

  it('measures creation and refresh as separate anonymous phases', async () => {
    const events: ClientPerformanceEvent[] = []
    const timestamps = [0, 0, 1200, 1200, 1700, 1700]
    const createClinic = vi.fn().mockResolvedValue({
      data: {
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
      },
      error: null,
    })
    const refreshClinics = vi.fn().mockResolvedValue({ data: [], error: null })

    await createPlatformClinicAndRefresh(
      {
        clinicName: 'Clínica Norte',
        ownerEmail: 'owner@example.com',
        ownerName: 'Dra. Andrea',
        planId: 'basic',
        priceTier: 'standard',
      },
      createClinic,
      refreshClinics,
      {
        createOperationId: () => 'operation-123',
        now: () => timestamps.shift() ?? 1700,
        record: (event) => events.push(event),
      },
    )

    expect(createClinic).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ operationId: 'operation-123' }),
    )
    expect(events).toEqual([
      {
        event: 'dayia.performance',
        operation: 'create_platform_clinic_flow',
        operationId: 'operation-123',
        outcome: 'success',
        phases: {
          create_request: 1200,
          list_refresh: 500,
        },
        source: 'frontend',
        totalMs: 1700,
      },
    ])
    expect(JSON.stringify(events)).not.toContain('owner@example.com')
    expect(JSON.stringify(events)).not.toContain('Clínica Norte')
  })

  it('preserves the disabled error and does not refresh the list', async () => {
    const createClinic = vi.fn().mockResolvedValue({
      data: null,
      error: 'La creación real de consultorios está deshabilitada.',
    })
    const refreshClinics = vi.fn()

    const result = await createPlatformClinicAndRefresh(
      {
        clinicName: 'Clínica Norte',
        ownerEmail: 'owner@example.com',
        ownerName: 'Dra. Andrea',
        planId: 'basic',
        priceTier: 'standard',
      },
      createClinic,
      refreshClinics,
    )

    expect(result.error).toBe(
      'La creación real de consultorios está deshabilitada.',
    )
    expect(refreshClinics).not.toHaveBeenCalled()
  })

  it('submits the real form payload to the creation handler', async () => {
    const createClinic = vi.fn().mockResolvedValue({ data: null, error: 'error' })
    const submissionLock = { current: false }
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'medium' as const,
      priceTier: 'founder' as const,
    }

    await submitPlatformClinicOnce(input, submissionLock, createClinic)

    expect(createClinic).toHaveBeenCalledOnce()
    expect(createClinic).toHaveBeenCalledWith(input)
  })

  it('blocks a second submit while the first request is pending', async () => {
    let resolveRequest: ((value: { data: null; error: string }) => void) | undefined
    const createClinic = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const submissionLock = { current: false }
    const input = {
      clinicName: 'Clínica Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Dra. Andrea',
      planId: 'basic' as const,
      priceTier: 'standard' as const,
    }

    const firstSubmit = submitPlatformClinicOnce(
      input,
      submissionLock,
      createClinic,
    )
    const secondSubmit = submitPlatformClinicOnce(
      input,
      submissionLock,
      createClinic,
    )

    await expect(secondSubmit).resolves.toBeNull()
    expect(createClinic).toHaveBeenCalledOnce()

    resolveRequest?.({ data: null, error: 'error' })
    await firstSubmit
    expect(submissionLock.current).toBe(false)
  })

  it('releases the submit lock after an unexpected request failure', async () => {
    const submissionLock = { current: false }
    const createClinic = vi.fn().mockRejectedValue(new Error('network detail'))

    await expect(
      submitPlatformClinicOnce(
        {
          clinicName: 'Clínica Norte',
          ownerEmail: 'owner@example.com',
          ownerName: 'Dra. Andrea',
          planId: 'basic',
          priceTier: 'standard',
        },
        submissionLock,
        createClinic,
      ),
    ).rejects.toThrow('network detail')
    expect(submissionLock.current).toBe(false)
  })
})
