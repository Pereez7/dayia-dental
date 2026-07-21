import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PlatformClinicSummary } from '../types/platform'
import {
  ClinicOnboardingFeedback,
  ClinicOnboardingForm,
} from '../components/ClinicOnboardingForm'
import {
  createPlatformClinicAndRefresh,
  submitPlatformClinicOnce,
} from '../utils/platformClinicCreation'
import {
  PlatformAdminView,
  PlatformClinicsContent,
} from './PlatformAdminView'

const clinic: PlatformClinicSummary = {
  activeMembersCount: 2,
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
  ownerName: 'Dra. Ana Pérez',
  planId: 'medium',
  planName: 'Medium',
  paymentStatus: 'paid',
  payments: [],
  subscriptionStatus: 'active',
  trialEndsAt: null,
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
    }

    await createPlatformClinicAndRefresh(input, createClinic, refreshClinics)

    expect(refreshClinics).toHaveBeenCalledOnce()
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
        },
        submissionLock,
        createClinic,
      ),
    ).rejects.toThrow('network detail')
    expect(submissionLock.current).toBe(false)
  })
})
