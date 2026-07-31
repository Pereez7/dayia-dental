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
  getPlatformClinicBilling,
  listPlatformClinics,
  resendPlatformClinicInvitation,
  type CorrectPlatformClinicOwnerEmailServiceResult,
  type CreatePlatformClinicServiceResult,
  type PlatformAdminServiceResult,
  type PlatformClinicBillingServiceResult,
  type ResendPlatformClinicInvitationServiceResult,
} from '../services/platformAdminService'
import type {
  CorrectPlatformClinicOwnerEmailInput,
  CreatePlatformClinicInput,
  GetPlatformClinicBillingInput,
  GetPlatformClinicBillingResponse,
  ListPlatformClinicsInput,
  PlatformClinicCursor,
  PlatformClinicListItem,
  PlatformPageInfo,
  PlatformPaymentCursor,
  PlatformSubmissionCursor,
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
  loadClinicBilling?: (
    input: GetPlatformClinicBillingInput,
  ) => Promise<PlatformClinicBillingServiceResult>
  loadClinics?: (
    input?: ListPlatformClinicsInput,
  ) => Promise<PlatformAdminServiceResult>
  resendInvitation?: (
    clinicId: string,
  ) => Promise<ResendPlatformClinicInvitationServiceResult>
}

interface PlatformClinicsContentProps {
  correctingClinicId?: string | null
  clinics: PlatformClinicListItem[]
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
  onNextPage?: () => void
  onPreviousPage?: () => void
  page?: number
  pageInfo?: PlatformPageInfo<PlatformClinicCursor>
  resendingClinicId?: string | null
}

const PLATFORM_CLINICS_PAGE_SIZE = 10
const EMPTY_CLINIC_PAGE_INFO: PlatformPageInfo<PlatformClinicCursor> = {
  hasNextPage: false,
  limit: PLATFORM_CLINICS_PAGE_SIZE,
  nextCursor: null,
  totalCount: 0,
}

export function PlatformAdminView({
  canAccessPlatformAdmin,
  correctOwnerEmail = correctPlatformClinicOwnerEmail,
  createClinic = createPlatformClinic,
  loadClinicBilling = getPlatformClinicBilling,
  loadClinics = listPlatformClinics,
  resendInvitation = resendPlatformClinicInvitation,
}: PlatformAdminViewProps) {
  const correctOwnerEmailLock = useRef<string | null>(null)
  const resendInvitationLock = useRef<string | null>(null)
  const selectedBillingRequestId = useRef(0)
  const [clinics, setClinics] = useState<PlatformClinicListItem[]>([])
  const [clinicPageCursors, setClinicPageCursors] = useState<
    Array<PlatformClinicCursor | null>
  >([null])
  const [clinicPageIndex, setClinicPageIndex] = useState(0)
  const [clinicPageInfo, setClinicPageInfo] = useState(
    EMPTY_CLINIC_PAGE_INFO,
  )
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
  const [selectedBilling, setSelectedBilling] =
    useState<GetPlatformClinicBillingResponse | null>(null)
  const [selectedBillingError, setSelectedBillingError] = useState('')
  const [isSelectedBillingLoading, setIsSelectedBillingLoading] =
    useState(false)
  const [paymentPageCursors, setPaymentPageCursors] = useState<
    Array<PlatformPaymentCursor | null>
  >([null])
  const [paymentPageIndex, setPaymentPageIndex] = useState(0)
  const [submissionPageCursors, setSubmissionPageCursors] = useState<
    Array<PlatformSubmissionCursor | null>
  >([null])
  const [submissionPageIndex, setSubmissionPageIndex] = useState(0)
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

  const applyClinicPage = useCallback(
    (result: NonNullable<PlatformAdminServiceResult['data']>) => {
      setClinics(result.clinics)
      setClinicPageInfo(result.pageInfo)
      setErrorMessage('')
    },
    [],
  )

  const loadPlatformClinics = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const result = await loadClinics({
      cursor: clinicPageCursors[clinicPageIndex] ?? null,
      limit: PLATFORM_CLINICS_PAGE_SIZE,
    })

    if (result.data) {
      applyClinicPage(result.data)
    } else {
      setErrorMessage(result.error ?? 'No pudimos cargar los consultorios.')
    }
    setIsLoading(false)
  }, [
    applyClinicPage,
    clinicPageCursors,
    clinicPageIndex,
    loadClinics,
  ])

  const refreshPlatformClinicsSilently = useCallback(async () => {
    const result = await loadClinics({
      cursor: clinicPageCursors[clinicPageIndex] ?? null,
      limit: PLATFORM_CLINICS_PAGE_SIZE,
    })

    if (result.data) {
      applyClinicPage(result.data)
    }
  }, [
    applyClinicPage,
    clinicPageCursors,
    clinicPageIndex,
    loadClinics,
  ])

  const refreshCreatedClinicList = useCallback(async () => {
    const result = await loadClinics({ limit: PLATFORM_CLINICS_PAGE_SIZE })

    if (result.error || !result.data) {
      throw new Error(
        result.error ?? 'No pudimos actualizar el listado de consultorios.',
      )
    }

    applyClinicPage(result.data)
    setClinicPageCursors([null])
    setClinicPageIndex(0)
  }, [applyClinicPage, loadClinics])

  const handleNextClinicPage = useCallback(async () => {
    const nextCursor = clinicPageInfo.nextCursor

    if (!nextCursor || isLoading) return

    setIsLoading(true)
    const result = await loadClinics({
      cursor: nextCursor,
      limit: PLATFORM_CLINICS_PAGE_SIZE,
    })

    if (result.data) {
      applyClinicPage(result.data)
      setClinicPageCursors((current) => [
        ...current.slice(0, clinicPageIndex + 1),
        nextCursor,
      ])
      setClinicPageIndex((current) => current + 1)
    } else {
      setErrorMessage(result.error ?? 'No pudimos cargar la página siguiente.')
    }
    setIsLoading(false)
  }, [
    applyClinicPage,
    clinicPageIndex,
    clinicPageInfo.nextCursor,
    isLoading,
    loadClinics,
  ])

  const handlePreviousClinicPage = useCallback(async () => {
    if (clinicPageIndex === 0 || isLoading) return

    const previousIndex = clinicPageIndex - 1
    const previousCursor = clinicPageCursors[previousIndex] ?? null
    setIsLoading(true)
    const result = await loadClinics({
      cursor: previousCursor,
      limit: PLATFORM_CLINICS_PAGE_SIZE,
    })

    if (result.data) {
      applyClinicPage(result.data)
      setClinicPageCursors((current) =>
        current.slice(0, previousIndex + 1)
      )
      setClinicPageIndex(previousIndex)
    } else {
      setErrorMessage(result.error ?? 'No pudimos cargar la página anterior.')
    }
    setIsLoading(false)
  }, [
    applyClinicPage,
    clinicPageCursors,
    clinicPageIndex,
    isLoading,
    loadClinics,
  ])

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

  const loadSelectedClinicBilling = useCallback(
    async (
      input: GetPlatformClinicBillingInput,
      options: { resetPayment?: boolean; resetSubmission?: boolean } = {},
    ) => {
      const requestId = selectedBillingRequestId.current + 1
      selectedBillingRequestId.current = requestId
      setIsSelectedBillingLoading(true)
      setSelectedBillingError('')

      try {
        const result = await loadClinicBilling(input)

        if (requestId !== selectedBillingRequestId.current) {
          return result
        }

        if (result.data) {
          setSelectedBilling(result.data)
          if (options.resetPayment) {
            setPaymentPageCursors([null])
            setPaymentPageIndex(0)
          }
          if (options.resetSubmission) {
            setSubmissionPageCursors([null])
            setSubmissionPageIndex(0)
          }
        } else {
          setSelectedBillingError(
            result.error ?? 'No pudimos cargar la gestión del consultorio.',
          )
        }

        return result
      } catch {
        const result = {
          data: null,
          error:
            'No pudimos comunicarnos con la gestión del consultorio. Intenta nuevamente.',
        }

        if (requestId === selectedBillingRequestId.current) {
          setSelectedBillingError(result.error)
        }

        return result
      } finally {
        if (requestId === selectedBillingRequestId.current) {
          setIsSelectedBillingLoading(false)
        }
      }
    },
    [loadClinicBilling],
  )

  const handleManageClinic = useCallback(
    (clinicId: string) => {
      setSelectedClinicId(clinicId)
      setSelectedBilling(null)
      setPaymentPageCursors([null])
      setPaymentPageIndex(0)
      setSubmissionPageCursors([null])
      setSubmissionPageIndex(0)
      void loadSelectedClinicBilling(
        { clinicId },
        { resetPayment: true, resetSubmission: true },
      )
    },
    [loadSelectedClinicBilling],
  )

  const closeSelectedClinic = useCallback(() => {
    selectedBillingRequestId.current += 1
    setSelectedClinicId(null)
    setSelectedBilling(null)
    setSelectedBillingError('')
    setIsSelectedBillingLoading(false)
    setPaymentPageCursors([null])
    setPaymentPageIndex(0)
    setSubmissionPageCursors([null])
    setSubmissionPageIndex(0)
  }, [])

  const handleNextPaymentPage = useCallback(async () => {
    const nextCursor = selectedBilling?.paymentPageInfo.nextCursor

    if (!selectedClinicId || !nextCursor || isSelectedBillingLoading) return

    const result = await loadSelectedClinicBilling({
      clinicId: selectedClinicId,
      paymentCursor: nextCursor,
      submissionCursor:
        submissionPageCursors[submissionPageIndex] ?? null,
    })

    if (result.data) {
      setPaymentPageCursors((current) => [
        ...current.slice(0, paymentPageIndex + 1),
        nextCursor,
      ])
      setPaymentPageIndex((current) => current + 1)
    }
  }, [
    isSelectedBillingLoading,
    loadSelectedClinicBilling,
    paymentPageIndex,
    selectedBilling?.paymentPageInfo.nextCursor,
    selectedClinicId,
    submissionPageCursors,
    submissionPageIndex,
  ])

  const handlePreviousPaymentPage = useCallback(async () => {
    if (
      !selectedClinicId ||
      paymentPageIndex === 0 ||
      isSelectedBillingLoading
    ) {
      return
    }

    const previousIndex = paymentPageIndex - 1
    const result = await loadSelectedClinicBilling({
      clinicId: selectedClinicId,
      paymentCursor: paymentPageCursors[previousIndex] ?? null,
      submissionCursor:
        submissionPageCursors[submissionPageIndex] ?? null,
    })

    if (result.data) {
      setPaymentPageCursors((current) =>
        current.slice(0, previousIndex + 1)
      )
      setPaymentPageIndex(previousIndex)
    }
  }, [
    isSelectedBillingLoading,
    loadSelectedClinicBilling,
    paymentPageCursors,
    paymentPageIndex,
    selectedClinicId,
    submissionPageCursors,
    submissionPageIndex,
  ])

  const handleNextSubmissionPage = useCallback(async () => {
    const nextCursor = selectedBilling?.submissionPageInfo.nextCursor

    if (!selectedClinicId || !nextCursor || isSelectedBillingLoading) return

    const result = await loadSelectedClinicBilling({
      clinicId: selectedClinicId,
      paymentCursor: paymentPageCursors[paymentPageIndex] ?? null,
      submissionCursor: nextCursor,
    })

    if (result.data) {
      setSubmissionPageCursors((current) => [
        ...current.slice(0, submissionPageIndex + 1),
        nextCursor,
      ])
      setSubmissionPageIndex((current) => current + 1)
    }
  }, [
    isSelectedBillingLoading,
    loadSelectedClinicBilling,
    paymentPageCursors,
    paymentPageIndex,
    selectedBilling?.submissionPageInfo.nextCursor,
    selectedClinicId,
    submissionPageIndex,
  ])

  const handlePreviousSubmissionPage = useCallback(async () => {
    if (
      !selectedClinicId ||
      submissionPageIndex === 0 ||
      isSelectedBillingLoading
    ) {
      return
    }

    const previousIndex = submissionPageIndex - 1
    const result = await loadSelectedClinicBilling({
      clinicId: selectedClinicId,
      paymentCursor: paymentPageCursors[paymentPageIndex] ?? null,
      submissionCursor: submissionPageCursors[previousIndex] ?? null,
    })

    if (result.data) {
      setSubmissionPageCursors((current) =>
        current.slice(0, previousIndex + 1)
      )
      setSubmissionPageIndex(previousIndex)
    }
  }, [
    isSelectedBillingLoading,
    loadSelectedClinicBilling,
    paymentPageCursors,
    paymentPageIndex,
    selectedClinicId,
    submissionPageCursors,
    submissionPageIndex,
  ])

  const refreshSelectedClinic = useCallback(async () => {
    if (!selectedClinicId) return

    await Promise.all([
      loadSelectedClinicBilling(
        { clinicId: selectedClinicId },
        { resetPayment: true, resetSubmission: true },
      ),
      refreshPlatformClinicsSilently(),
    ])
  }, [
    loadSelectedClinicBilling,
    refreshPlatformClinicsSilently,
    selectedClinicId,
  ])

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

    void loadClinics({ limit: PLATFORM_CLINICS_PAGE_SIZE }).then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.data) {
        applyClinicPage(result.data)
      } else {
        setErrorMessage(result.error ?? 'No pudimos cargar los consultorios.')
      }
      setIsLoading(false)
    })

    return () => {
      isCurrent = false
    }
  }, [applyClinicPage, canAccessPlatformAdmin, loadClinics])

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
          onManage={handleManageClinic}
          onNextPage={handleNextClinicPage}
          onPreviousPage={handlePreviousClinicPage}
          page={clinicPageIndex + 1}
          pageInfo={clinicPageInfo}
          resendingClinicId={resendingClinicId}
        />
      </section>

      {selectedClinicId && isSelectedBillingLoading && !selectedBilling ? (
        <section
          aria-label="Cargando gestión del consultorio"
          className="administration-panel platform-clinics-feedback"
          role="status"
        >
          <strong>Cargando gestión comercial…</strong>
          <p>Estamos consultando únicamente el detalle de este consultorio.</p>
        </section>
      ) : null}

      {selectedClinicId && selectedBillingError && !selectedBilling ? (
        <section
          className="administration-panel platform-clinics-feedback"
          role="alert"
        >
          <strong>No se pudo cargar la gestión</strong>
          <p>{selectedBillingError}</p>
          <div className="platform-detail-feedback-actions">
            <button
              className="secondary-action"
              onClick={() =>
                void loadSelectedClinicBilling({ clinicId: selectedClinicId })
              }
              type="button"
            >
              Reintentar
            </button>
            <button
              className="secondary-action"
              onClick={closeSelectedClinic}
              type="button"
            >
              Cerrar
            </button>
          </div>
        </section>
      ) : null}

      {selectedBilling ? (
        <SubscriptionAdministration
          clinic={selectedBilling.clinic}
          isPageLoading={isSelectedBillingLoading}
          key={selectedBilling.clinic.clinicId}
          paymentPage={paymentPageIndex + 1}
          paymentPageInfo={selectedBilling.paymentPageInfo}
          submissionPage={submissionPageIndex + 1}
          submissionPageInfo={selectedBilling.submissionPageInfo}
          onClose={closeSelectedClinic}
          onNextPaymentPage={() => void handleNextPaymentPage()}
          onNextSubmissionPage={() => void handleNextSubmissionPage()}
          onPreviousPaymentPage={() => void handlePreviousPaymentPage()}
          onPreviousSubmissionPage={() =>
            void handlePreviousSubmissionPage()
          }
          onUpdated={refreshSelectedClinic}
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
      {count === 1
        ? 'pago por revisar en esta página'
        : 'pagos por revisar en esta página'}
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
  onNextPage,
  onPreviousPage,
  page = 1,
  pageInfo = EMPTY_CLINIC_PAGE_INFO,
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
    <div className="platform-clinics-list">
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
      <PlatformClinicListPagination
        itemCount={clinics.length}
        page={page}
        pageInfo={pageInfo}
        onNext={onNextPage}
        onPrevious={onPreviousPage}
      />
    </div>
  )
}

export function PlatformClinicListPagination({
  itemCount,
  onNext,
  onPrevious,
  page,
  pageInfo,
}: {
  itemCount: number
  onNext?: () => void
  onPrevious?: () => void
  page: number
  pageInfo: PlatformPageInfo<PlatformClinicCursor>
}) {
  if (pageInfo.totalCount <= pageInfo.limit && page === 1) return null

  const start = (page - 1) * pageInfo.limit + 1
  const end = start + Math.max(0, itemCount - 1)
  const pageCount = Math.max(
    1,
    Math.ceil(pageInfo.totalCount / pageInfo.limit),
  )

  return (
    <div className="platform-clinics-pagination">
      <p aria-live="polite">
        Mostrando <strong>{start}–{end}</strong> de{' '}
        <strong>{pageInfo.totalCount}</strong> consultorios
      </p>
      <nav aria-label="Paginación de consultorios">
        <button
          className="subscription-pagination-direction"
          disabled={page === 1}
          onClick={onPrevious}
          type="button"
        >
          Anterior
        </button>
        <span>
          Página {page} de {pageCount}
        </span>
        <button
          className="subscription-pagination-direction"
          disabled={!pageInfo.hasNextPage}
          onClick={onNext}
          type="button"
        >
          Siguiente
        </button>
      </nav>
    </div>
  )
}

function getPendingPaymentCount(clinic: PlatformClinicListItem) {
  return clinic.pendingPaymentSubmissionsCount
}

function formatPlatformDate(value: string) {
  return formatAppDate(value.slice(0, 10))
}
