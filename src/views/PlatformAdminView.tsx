import { useCallback, useEffect, useState } from 'react'

import { ClinicOnboardingForm } from '../components/ClinicOnboardingForm'
import {
  listPlatformClinics,
  type PlatformAdminServiceResult,
} from '../services/platformAdminService'
import type {
  PlatformClinicStatus,
  PlatformClinicSummary,
  PlatformSubscriptionStatus,
} from '../types/platform'

interface PlatformAdminViewProps {
  canAccessPlatformAdmin: boolean
  loadClinics?: () => Promise<PlatformAdminServiceResult>
}

interface PlatformClinicsContentProps {
  clinics: PlatformClinicSummary[]
  errorMessage: string
  isLoading: boolean
  onRetry?: () => void
}

const clinicStatusLabels: Record<PlatformClinicStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  unknown: 'Sin estado',
}

const subscriptionStatusLabels: Record<PlatformSubscriptionStatus, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  past_due: 'Pago pendiente',
  suspended: 'Suspendida',
  trial: 'Prueba',
  unknown: 'Sin estado',
}

export function PlatformAdminView({
  canAccessPlatformAdmin,
  loadClinics = listPlatformClinics,
}: PlatformAdminViewProps) {
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(canAccessPlatformAdmin)

  const loadPlatformClinics = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const result = await loadClinics()

    setClinics(result.data ?? [])
    setErrorMessage(result.error ?? '')
    setIsLoading(false)
  }, [loadClinics])

  useEffect(() => {
    if (!canAccessPlatformAdmin) {
      return
    }

    let isCurrent = true

    void loadClinics().then((result) => {
      if (!isCurrent) {
        return
      }

      setClinics(result.data ?? [])
      setErrorMessage(result.error ?? '')
      setIsLoading(false)
    })

    return () => {
      isCurrent = false
    }
  }, [canAccessPlatformAdmin, loadClinics])

  if (!canAccessPlatformAdmin) {
    return (
      <section className="platform-admin-access-denied" role="alert">
        <h2>Acceso no autorizado</h2>
        <p>No tienes permiso para acceder a Administración DayIA.</p>
      </section>
    )
  }

  return (
    <div className="administration-view">
      <section
        className="administration-panel platform-clinics-panel"
        aria-labelledby="platform-clinics-title"
      >
        <div className="administration-panel-header">
          <div>
            <h2 id="platform-clinics-title">Consultorios</h2>
            <p>Resumen administrativo de las cuentas registradas en DayIA Dental.</p>
          </div>
        </div>

        <PlatformClinicsContent
          clinics={clinics}
          errorMessage={errorMessage}
          isLoading={isLoading}
          onRetry={loadPlatformClinics}
        />
      </section>

      <ClinicOnboardingForm />
    </div>
  )
}

export function PlatformClinicsContent({
  clinics,
  errorMessage,
  isLoading,
  onRetry,
}: PlatformClinicsContentProps) {
  if (isLoading) {
    return (
      <div
        className="platform-clinics-loading"
        aria-label="Cargando consultorios"
        role="status"
      >
        {[0, 1, 2].map((row) => (
          <div className="platform-clinic-skeleton" key={row}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="platform-clinics-feedback" role="alert">
        <strong>No se pudo cargar el listado</strong>
        <p>{errorMessage}</p>
        {onRetry && (
          <button className="secondary-action" onClick={onRetry} type="button">
            Reintentar carga
          </button>
        )}
      </div>
    )
  }

  if (clinics.length === 0) {
    return (
      <div className="platform-clinics-feedback" role="status">
        <strong>Aún no hay consultorios registrados</strong>
        <p>Los consultorios aparecerán aquí cuando existan en la plataforma.</p>
      </div>
    )
  }

  return (
    <div className="platform-clinics-table-wrap">
      <table className="platform-clinics-table">
        <thead>
          <tr>
            <th scope="col">Consultorio</th>
            <th scope="col">Plan</th>
            <th scope="col">Propietario</th>
            <th scope="col">Miembros</th>
            <th scope="col">Creación</th>
          </tr>
        </thead>
        <tbody>
          {clinics.map((clinic) => (
            <tr key={clinic.clinicId}>
              <td data-label="Consultorio">
                <strong>{clinic.clinicName}</strong>
                <span
                  className={`platform-status platform-status--${clinic.clinicStatus}`}
                >
                  {clinicStatusLabels[clinic.clinicStatus]}
                </span>
              </td>
              <td data-label="Plan">
                <strong>{clinic.planName ?? 'Sin plan'}</strong>
                <span>
                  {clinic.subscriptionStatus
                    ? subscriptionStatusLabels[clinic.subscriptionStatus]
                    : 'Sin suscripción'}
                </span>
              </td>
              <td data-label="Propietario">
                <strong>{clinic.ownerName ?? 'Sin propietario asignado'}</strong>
                <span>{clinic.ownerEmail ?? 'Sin email registrado'}</span>
              </td>
              <td data-label="Miembros">
                <strong>{clinic.activeMembersCount}</strong>
                <span>activos</span>
              </td>
              <td data-label="Creación">
                <strong>{formatPlatformDate(clinic.createdAt)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatPlatformDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
