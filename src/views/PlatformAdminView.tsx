import { useCallback, useEffect, useState } from 'react'

import { ClinicOnboardingForm } from '../components/ClinicOnboardingForm'
import { SubscriptionAdministration } from '../components/SubscriptionAdministration'
import {
  createPlatformClinic,
  listPlatformClinics,
  type CreatePlatformClinicServiceResult,
  type PlatformAdminServiceResult,
} from '../services/platformAdminService'
import type {
  CreatePlatformClinicInput,
  PlatformClinicSummary,
} from '../types/platform'
import {
  getPlatformClinicStatusLabel,
  getPlatformSubscriptionStatusLabel,
} from '../utils/platformStatusLabels'
import { createPlatformClinicAndRefresh } from '../utils/platformClinicCreation'
import { formatAppDate } from '../utils/dateFormatters'

interface PlatformAdminViewProps {
  canAccessPlatformAdmin: boolean
  createClinic?: (
    input: CreatePlatformClinicInput,
  ) => Promise<CreatePlatformClinicServiceResult>
  loadClinics?: () => Promise<PlatformAdminServiceResult>
}

interface PlatformClinicsContentProps {
  clinics: PlatformClinicSummary[]
  errorMessage: string
  isLoading: boolean
  onRetry?: () => void
  onManage?: (clinicId: string) => void
}

export function PlatformAdminView({
  canAccessPlatformAdmin,
  createClinic = createPlatformClinic,
  loadClinics = listPlatformClinics,
}: PlatformAdminViewProps) {
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(canAccessPlatformAdmin)
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)

  const loadPlatformClinics = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const result = await loadClinics()

    setClinics(result.data ?? [])
    setErrorMessage(result.error ?? '')
    setIsLoading(false)
  }, [loadClinics])

  const refreshPlatformClinicsSilently = useCallback(async () => {
    const result = await loadClinics()

    if (result.data) {
      setClinics(result.data)
      setErrorMessage('')
    }
  }, [loadClinics])

  const createClinicAndRefresh = useCallback(
    (input: CreatePlatformClinicInput) =>
      createPlatformClinicAndRefresh(input, createClinic, loadPlatformClinics),
    [createClinic, loadPlatformClinics],
  )

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

  useEffect(() => {
    if (!canAccessPlatformAdmin) return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshPlatformClinicsSilently()
      }
    }
    const intervalId = window.setInterval(refreshWhenVisible, 60_000)

    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [canAccessPlatformAdmin, refreshPlatformClinicsSilently])

  if (!canAccessPlatformAdmin) {
    return (
      <section className="platform-admin-access-denied" role="alert">
        <h2>Acceso no autorizado</h2>
        <p>No tienes permiso para acceder a Administración DayIA.</p>
      </section>
    )
  }

  const selectedClinic = clinics.find(({ clinicId }) => clinicId === selectedClinicId)
  const pendingPaymentsCount = clinics.reduce(
    (total, clinic) => total + getPendingPaymentCount(clinic),
    0,
  )

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
          <PlatformPaymentOverview count={pendingPaymentsCount} />
        </div>

        <PlatformClinicsContent
          clinics={clinics}
          errorMessage={errorMessage}
          isLoading={isLoading}
          onRetry={loadPlatformClinics}
          onManage={setSelectedClinicId}
        />
      </section>

      {selectedClinic ? (
        <SubscriptionAdministration
          clinic={selectedClinic}
          key={selectedClinic.clinicId}
          onClose={() => setSelectedClinicId(null)}
          onUpdated={loadPlatformClinics}
        />
      ) : null}

      <ClinicOnboardingForm
        onCreate={createClinicAndRefresh}
      />
    </div>
  )
}

export function PlatformPaymentOverview({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span className="platform-payment-overview" role="status">
      <strong>{count}</strong>
      {count === 1 ? 'pago por revisar' : 'pagos por revisar'}
    </span>
  )
}

export function PlatformClinicsContent({
  clinics,
  errorMessage,
  isLoading,
  onRetry,
  onManage,
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
            {onManage ? <th scope="col">Suscripción</th> : null}
          </tr>
        </thead>
        <tbody>
          {clinics.map((clinic) => {
            const pendingPaymentCount = getPendingPaymentCount(clinic)

            return (
              <tr key={clinic.clinicId}>
                <td data-label="Consultorio">
                  <strong>{clinic.clinicName}</strong>
                  <div className="platform-clinic-statuses">
                    <span
                      className={`platform-status platform-status--${clinic.clinicStatus ?? 'unknown'}`}
                    >
                      {getPlatformClinicStatusLabel(clinic.clinicStatus)}
                    </span>
                    {pendingPaymentCount > 0 ? (
                      <span className="platform-payment-badge">
                        Revisar pago
                        {pendingPaymentCount > 1
                          ? ` (${pendingPaymentCount})`
                          : ''}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td data-label="Plan">
                  <strong>{clinic.planName ?? 'Sin plan'}</strong>
                  <span>
                    {getPlatformSubscriptionStatusLabel(
                      clinic.subscriptionStatus,
                    )}
                  </span>
                </td>
                <td data-label="Propietario">
                  {clinic.ownerName || clinic.ownerEmail ? (
                    <>
                      <strong>
                        {clinic.ownerName ?? 'Propietario sin nombre'}
                      </strong>
                      <span>
                        {clinic.ownerEmail ?? 'Sin email registrado'}
                      </span>
                    </>
                  ) : (
                    <strong>Sin propietario</strong>
                  )}
                </td>
                <td data-label="Miembros">
                  <strong>{clinic.activeMembersCount}</strong>
                  <span>activos</span>
                </td>
                <td data-label="Creación">
                  <strong>{formatPlatformDate(clinic.createdAt)}</strong>
                </td>
                {onManage ? (
                  <td data-label="Suscripción">
                    <button
                      className="secondary-action"
                      onClick={() => onManage(clinic.clinicId)}
                      type="button"
                    >
                      Gestionar cobro
                    </button>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function getPendingPaymentCount(clinic: PlatformClinicSummary) {
  return clinic.paymentSubmissions.filter(
    ({ status }) => status === 'pending_review',
  ).length
}

function formatPlatformDate(value: string) {
  return formatAppDate(value.slice(0, 10))
}
