import { useCallback, useEffect, useRef, useState } from 'react'

import { ClinicOnboardingForm } from '../components/ClinicOnboardingForm'
import {
  PlatformOwnerInvitationActions,
  type PlatformInvitationNotice,
} from '../components/PlatformOwnerInvitationActions'
import { SubscriptionAdministration } from '../components/SubscriptionAdministration'
import { Toast, type ToastTone } from '../components/Toast'
import {
  correctPlatformClinicOwnerEmail,
  createPlatformClinic,
  listPlatformClinics,
  resendPlatformClinicInvitation,
  type CorrectPlatformClinicOwnerEmailServiceResult,
  type CreatePlatformClinicServiceResult,
  type PlatformAdminServiceResult,
  type ResendPlatformClinicInvitationServiceResult,
} from '../services/platformAdminService'
import type {
  CorrectPlatformClinicOwnerEmailInput,
  CreatePlatformClinicInput,
  PlatformClinicSummary,
} from '../types/platform'
import {
  getPlatformClinicStatusLabel,
  getPlatformSubscriptionStatusLabel,
} from '../utils/platformStatusLabels'
import {
  createPlatformClinicAndRefresh,
  type PlatformClinicRefreshState,
} from '../utils/platformClinicCreation'
import { formatAppDate } from '../utils/dateFormatters'

interface PlatformAdminViewProps {
  canAccessPlatformAdmin: boolean
  correctOwnerEmail?: (
    input: CorrectPlatformClinicOwnerEmailInput,
  ) => Promise<CorrectPlatformClinicOwnerEmailServiceResult>
  createClinic?: (
    input: CreatePlatformClinicInput,
  ) => Promise<CreatePlatformClinicServiceResult>
  loadClinics?: () => Promise<PlatformAdminServiceResult>
  resendInvitation?: (
    clinicId: string,
  ) => Promise<ResendPlatformClinicInvitationServiceResult>
}

interface PlatformClinicsContentProps {
  correctingClinicId?: string | null
  clinics: PlatformClinicSummary[]
  errorMessage: string
  invitationNotices?: Record<string, PlatformInvitationNotice>
  isLoading: boolean
  onCorrectOwnerEmail?: (
    clinicId: string,
    email: string,
  ) => Promise<boolean>
  onResendInvitation?: (clinicId: string) => void
  onRetry?: () => void
  onManage?: (clinicId: string) => void
  resendingClinicId?: string | null
}

export function PlatformAdminView({
  canAccessPlatformAdmin,
  correctOwnerEmail = correctPlatformClinicOwnerEmail,
  createClinic = createPlatformClinic,
  loadClinics = listPlatformClinics,
  resendInvitation = resendPlatformClinicInvitation,
}: PlatformAdminViewProps) {
  const correctOwnerEmailLock = useRef<string | null>(null)
  const resendInvitationLock = useRef<string | null>(null)
  const [clinics, setClinics] = useState<PlatformClinicSummary[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [invitationNotices, setInvitationNotices] = useState<
    Record<string, PlatformInvitationNotice>
  >({})
  const [isLoading, setIsLoading] = useState(canAccessPlatformAdmin)
  const [creationRefreshState, setCreationRefreshState] =
    useState<PlatformClinicRefreshState>('idle')
  const [correctingClinicId, setCorrectingClinicId] = useState<string | null>(
    null,
  )
  const [resendingClinicId, setResendingClinicId] = useState<string | null>(
    null,
  )
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const [isToastVisible, setIsToastVisible] = useState(false)

  const showInvitationToast = useCallback(
    (message: string, tone: ToastTone) => {
      setToastMessage(message)
      setToastTone(tone)
      setIsToastVisible(true)
    },
    [],
  )

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

  const refreshCreatedClinicList = useCallback(async () => {
    const result = await loadClinics()

    if (result.error || !result.data) {
      throw new Error(
        result.error ?? 'No pudimos actualizar el listado de consultorios.',
      )
    }

    setClinics(result.data)
    setErrorMessage('')
  }, [loadClinics])

  const createClinicAndRefresh = useCallback(
    (input: CreatePlatformClinicInput) =>
      createPlatformClinicAndRefresh(
        input,
        createClinic,
        refreshCreatedClinicList,
        {
          onRefreshStateChange: setCreationRefreshState,
        },
      ),
    [createClinic, refreshCreatedClinicList],
  )

  const retryCreatedClinicRefresh = useCallback(
    async () => {
      setCreationRefreshState('refreshing')

      try {
        await refreshCreatedClinicList()
        setCreationRefreshState('success')
      } catch {
        setCreationRefreshState('error')
      }
    },
    [refreshCreatedClinicList],
  )

  const handleResendInvitation = useCallback(
    async (clinicId: string) => {
      if (correctOwnerEmailLock.current || resendInvitationLock.current) return

      resendInvitationLock.current = clinicId
      setResendingClinicId(clinicId)
      setInvitationNotices((current) => {
        const next = { ...current }
        delete next[clinicId]
        return next
      })

      try {
        const result = await resendInvitation(clinicId)

        showInvitationToast(
          result.data
            ? 'Invitación reenviada correctamente.'
            : (result.error ??
                'No pudimos reenviar la invitación. Intenta nuevamente.'),
          result.data ? 'success' : 'error',
        )
        await refreshPlatformClinicsSilently()
      } finally {
        resendInvitationLock.current = null
        setResendingClinicId(null)
      }
    },
    [refreshPlatformClinicsSilently, resendInvitation, showInvitationToast],
  )

  const handleCorrectOwnerEmail = useCallback(
    async (clinicId: string, ownerEmail: string) => {
      if (correctOwnerEmailLock.current || resendInvitationLock.current) {
        return false
      }

      correctOwnerEmailLock.current = clinicId
      setCorrectingClinicId(clinicId)
      setInvitationNotices((current) => {
        const next = { ...current }
        delete next[clinicId]
        return next
      })

      try {
        const result = await correctOwnerEmail({ clinicId, ownerEmail })

        if (result.data) {
          setInvitationNotices((current) => {
            const next = { ...current }
            delete next[clinicId]
            return next
          })
          showInvitationToast(
            'Correo actualizado. Invitación enviada.',
            'success',
          )
          setClinics((current) =>
            current.map((clinic) =>
              clinic.clinicId === clinicId
                ? {
                    ...clinic,
                    ownerEmail: result.data?.email ?? clinic.ownerEmail,
                    ownerInvitationSentAt:
                      result.data?.sentAt ?? clinic.ownerInvitationSentAt,
                    ownerMembershipStatus: 'pending_activation',
                  }
                : clinic,
            ),
          )
          await refreshPlatformClinicsSilently()
          return true
        }

        setInvitationNotices((current) => ({
          ...current,
          [clinicId]: {
            message:
              result.error ??
              'No pudimos corregir el correo del propietario.',
            tone: 'error',
          },
        }))
        return false
      } finally {
        correctOwnerEmailLock.current = null
        setCorrectingClinicId(null)
      }
    },
    [correctOwnerEmail, refreshPlatformClinicsSilently, showInvitationToast],
  )

  useEffect(() => {
    if (!isToastVisible) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setIsToastVisible(false), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

  useEffect(() => {
    if (isToastVisible || !toastMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 220)
    return () => window.clearTimeout(timeoutId)
  }, [isToastVisible, toastMessage])

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
          correctingClinicId={correctingClinicId}
          errorMessage={errorMessage}
          invitationNotices={invitationNotices}
          isLoading={isLoading}
          onCorrectOwnerEmail={handleCorrectOwnerEmail}
          onResendInvitation={handleResendInvitation}
          onRetry={loadPlatformClinics}
          onManage={setSelectedClinicId}
          resendingClinicId={resendingClinicId}
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
        onRetryRefresh={retryCreatedClinicRefresh}
        refreshState={creationRefreshState}
      />
      <Toast
        message={toastMessage}
        tone={toastTone}
        visible={isToastVisible}
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
  correctingClinicId = null,
  errorMessage,
  invitationNotices = {},
  isLoading,
  onCorrectOwnerEmail,
  onResendInvitation,
  onRetry,
  onManage,
  resendingClinicId = null,
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
                      {clinic.clinicStatus === 'pending_activation' ? (
                        <PlatformOwnerInvitationActions
                          canCorrectEmail={Boolean(
                            onCorrectOwnerEmail && clinic.ownerEmail,
                          )}
                          canResend={
                            clinic.ownerMembershipStatus ===
                              'pending_activation' &&
                            Boolean(onResendInvitation && clinic.ownerEmail)
                          }
                          currentEmail={clinic.ownerEmail ?? ''}
                          isCorrecting={
                            correctingClinicId === clinic.clinicId
                          }
                          isDisabled={Boolean(
                            (correctingClinicId &&
                              correctingClinicId !== clinic.clinicId) ||
                              (resendingClinicId &&
                                resendingClinicId !== clinic.clinicId),
                          )}
                          isResending={
                            resendingClinicId === clinic.clinicId
                          }
                          notice={invitationNotices[clinic.clinicId]}
                          onCorrectEmail={
                            onCorrectOwnerEmail
                              ? (email) =>
                                  onCorrectOwnerEmail(
                                    clinic.clinicId,
                                    email,
                                  )
                              : undefined
                          }
                          onResend={
                            onResendInvitation
                              ? () =>
                                  onResendInvitation(clinic.clinicId)
                              : undefined
                          }
                        />
                      ) : null}
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
