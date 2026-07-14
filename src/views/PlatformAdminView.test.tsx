import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PlatformClinicSummary } from '../types/platform'
import { ClinicOnboardingForm } from '../components/ClinicOnboardingForm'
import { createPlatformClinicAndRefresh } from '../utils/platformClinicCreation'
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
  ownerEmail: 'ana@clinic.test',
  ownerName: 'Dra. Ana Pérez',
  planId: 'medium',
  planName: 'Medium',
  subscriptionStatus: 'active',
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

  it('keeps the onboarding form in validation mode by default', () => {
    const markup = renderToStaticMarkup(<ClinicOnboardingForm />)

    expect(markup).toContain('Modo de validación')
    expect(markup).toContain('Validar alta')
    expect(markup).not.toContain('Preparar consultorio')
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
})
