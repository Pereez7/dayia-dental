import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ConfirmDialog } from './ConfirmDialog'
import { Toast, type ToastTone } from './Toast'
import type {
  ClinicUser,
  ClinicUserFormErrors,
  ClinicUserFormValues,
} from '../types/ClinicUser'
import {
  clinicUserRoleOptions,
  getClinicUserRoleLabel,
  hasClinicUserFormErrors,
  isOnlyCurrentClinicUser,
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
  validateClinicUserForm,
} from '../utils/clinicUsers'
import { formatAppDate } from '../utils/dateFormatters'

interface ClinicUsersSettingsProps {
  canManageUsers: boolean
  canMigrateOwnerEmail?: boolean
  currentUserId?: string | null
  errorMessage?: string
  isLoading?: boolean
  maxUsers: number
  memberCount: number
  onCreateUser: (
    values: ClinicUserFormValues,
  ) =>
    | Promise<{ error?: string; success: boolean }>
    | { error?: string; success: boolean }
  onMigrateOwnerEmail?: () =>
    | Promise<{ error?: string; success: boolean }>
    | { error?: string; success: boolean }
  onSetUserStatus?: (
    user: ClinicUser,
    targetStatus: 'active' | 'inactive',
    reason: string,
  ) =>
    | Promise<{ error?: string; success: boolean }>
    | { error?: string; success: boolean }
  users: ClinicUser[]
}

interface ClinicUserLifecycleDraft {
  targetStatus: 'active' | 'inactive'
  userId: string
}

const initialFormValues: ClinicUserFormValues = {
  email: '',
  fullName: '',
  role: 'doctor',
}

export function ClinicUsersSettings({
  canManageUsers,
  canMigrateOwnerEmail = false,
  currentUserId,
  errorMessage = '',
  isLoading = false,
  maxUsers,
  memberCount,
  onCreateUser,
  onMigrateOwnerEmail,
  onSetUserStatus,
  users,
}: ClinicUsersSettingsProps) {
  const [fieldErrors, setFieldErrors] = useState<ClinicUserFormErrors>({})
  const [formValues, setFormValues] =
    useState<ClinicUserFormValues>(initialFormValues)
  const [formMessage, setFormMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMigratingOwnerEmail, setIsMigratingOwnerEmail] = useState(false)
  const [isOwnerEmailDialogOpen, setIsOwnerEmailDialogOpen] = useState(false)
  const [isOwnerEmailActionHidden, setIsOwnerEmailActionHidden] =
    useState(false)
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [lifecycleDraft, setLifecycleDraft] =
    useState<ClinicUserLifecycleDraft | null>(null)
  const [lifecycleError, setLifecycleError] = useState('')
  const [lifecycleReason, setLifecycleReason] = useState('')
  const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState<ToastTone>('success')
  const submissionLock = useRef(false)
  const lifecycleLock = useRef(false)

  const sortedUsers = useMemo(
    () =>
      [...users].sort((firstUser, secondUser) =>
        firstUser.fullName.localeCompare(secondUser.fullName, 'es'),
      ),
    [users],
  )
  const isCurrentUserOnly =
    isOnlyCurrentClinicUser(sortedUsers, currentUserId)
  const hasReachedLimit = memberCount >= maxUsers

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    const nextErrors = validateClinicUserForm(formValues)
    setFieldErrors(nextErrors)
    setFormMessage('')

    if (hasClinicUserFormErrors(nextErrors)) {
      return
    }

    if (hasReachedLimit) {
      setFormMessage('Tu plan alcanzó el límite de usuarios.')
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)
    let result: Awaited<ReturnType<typeof onCreateUser>>

    try {
      result = await onCreateUser({
        email: normalizeClinicUserEmail(formValues.email),
        fullName: normalizeClinicUserFullName(formValues.fullName),
        role: formValues.role,
      })
    } catch {
      result = {
        error: 'No pudimos invitar al usuario. Intenta nuevamente.',
        success: false,
      }
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }

    if (!result.success) {
      const message = result.error ?? 'No pudimos crear el usuario.'
      setFormMessage(message)
      setToastMessage(message)
      setToastTone('error')
      setIsToastVisible(true)
      return
    }

    setFormValues(initialFormValues)
    setFieldErrors({})
    setFormMessage('')
    setToastMessage('Usuario invitado al consultorio.')
    setToastTone('success')
    setIsToastVisible(true)
  }

  async function handleConfirmOwnerEmailMigration() {
    if (!onMigrateOwnerEmail || isMigratingOwnerEmail) {
      return
    }

    setIsMigratingOwnerEmail(true)
    const result = await onMigrateOwnerEmail()
    setIsMigratingOwnerEmail(false)

    if (!result.success) {
      const message =
        result.error ?? 'No pudimos actualizar el correo de acceso.'
      setFormMessage(message)
      setToastMessage(message)
      setToastTone('error')
      setIsToastVisible(true)
      setIsOwnerEmailDialogOpen(false)
      return
    }

    setIsOwnerEmailActionHidden(true)
    setIsOwnerEmailDialogOpen(false)
  }

  function openLifecycleReview(
    user: ClinicUser,
    targetStatus: 'active' | 'inactive',
  ) {
    setLifecycleDraft({ targetStatus, userId: user.id })
    setLifecycleReason('')
    setLifecycleError('')
    setIsToastVisible(false)
  }

  function closeLifecycleReview() {
    if (isUpdatingLifecycle) return
    setLifecycleDraft(null)
    setLifecycleReason('')
    setLifecycleError('')
  }

  async function handleLifecycleSubmit(
    event: FormEvent<HTMLFormElement>,
    user: ClinicUser,
  ) {
    event.preventDefault()

    if (
      !lifecycleDraft ||
      lifecycleDraft.userId !== user.id ||
      !onSetUserStatus ||
      lifecycleLock.current
    ) {
      return
    }

    const reason = lifecycleReason.trim().replace(/\s+/g, ' ')

    if (reason.length < 5) {
      setLifecycleError('Explica el motivo con al menos 5 caracteres.')
      return
    }

    if (lifecycleDraft.targetStatus === 'active' && hasReachedLimit) {
      setLifecycleError('Tu plan alcanzó el límite de usuarios.')
      return
    }

    lifecycleLock.current = true
    setIsUpdatingLifecycle(true)
    setLifecycleError('')
    let result: Awaited<ReturnType<typeof onSetUserStatus>>

    try {
      result = await onSetUserStatus(
        user,
        lifecycleDraft.targetStatus,
        reason,
      )
    } catch {
      result = {
        error: 'No pudimos actualizar el acceso. Intenta nuevamente.',
        success: false,
      }
    } finally {
      lifecycleLock.current = false
      setIsUpdatingLifecycle(false)
    }

    if (!result.success) {
      setLifecycleError(
        result.error ?? 'No pudimos actualizar el acceso del usuario.',
      )
      return
    }

    const wasReactivated = lifecycleDraft.targetStatus === 'active'
    setToastMessage(
      wasReactivated
        ? `Acceso de ${user.fullName} reactivado.`
        : `Acceso de ${user.fullName} desactivado.`,
    )
    setToastTone('success')
    setIsToastVisible(true)
    setLifecycleDraft(null)
    setLifecycleReason('')
    setLifecycleError('')
  }

  return (
    <section className="settings-panel clinic-users-panel">
      <div className="section-heading">
        <h2>Usuarios del consultorio</h2>
        <p className="section-description">
          Administra quién puede acceder a este consultorio. Si trabajas solo,
          no necesitas agregar más usuarios.
        </p>
        <p className="clinic-users-limit" aria-live="polite">
          Usuarios: <strong>{memberCount} de {maxUsers}</strong>
        </p>
      </div>

      {errorMessage && (
        <p className="field-message field-message--error">{errorMessage}</p>
      )}

      <div className="clinic-users-list" aria-live="polite">
        {isLoading && <p className="settings-note">Cargando usuarios...</p>}

        {!isLoading && sortedUsers.length === 0 && (
          <p className="settings-note">Aún no hay usuarios para mostrar.</p>
        )}

        {!isLoading &&
          sortedUsers.map((user) => {
            const isInvitationPending =
              user.status === 'pending' || user.status === 'pending_activation'
            const shouldShowOwnerEmailMigration =
              canMigrateOwnerEmail &&
              !isOwnerEmailActionHidden &&
              user.id === currentUserId &&
              user.email === 'charles@test.com'
            const canChangeLifecycle =
              canManageUsers &&
              Boolean(onSetUserStatus) &&
              Boolean(user.membershipId) &&
              user.id !== currentUserId &&
              user.role !== 'clinic_owner' &&
              (user.status === 'active' || user.status === 'inactive')
            const isLifecycleReviewOpen =
              lifecycleDraft?.userId === user.id
            const targetStatus =
              user.status === 'active' ? 'inactive' : 'active'

            return (
              <article className="clinic-user-row" key={user.id}>
                <div className="clinic-user-main">
                  <div className="clinic-user-title-row">
                    <h3>{user.fullName}</h3>
                    {user.id === currentUserId && (
                      <span className="clinic-user-you">Tú</span>
                    )}
                  </div>
                  <p>{user.email || 'Email no disponible'}</p>
                  <span>
                    {user.invitedAt
                      ? `Invitado el ${formatClinicUserDate(user.invitedAt)}`
                      : user.createdAt
                        ? `Miembro desde el ${formatClinicUserDate(user.createdAt)}`
                        : 'Fecha de invitación pendiente'}
                  </span>
                </div>
                <div className="clinic-user-badges">
                  <span className="clinic-user-role">
                    {getClinicUserRoleLabel(user.role)}
                  </span>
                  <span
                    className={`clinic-user-status ${
                      isInvitationPending
                        ? 'clinic-user-status--invited'
                        : user.status === 'active'
                          ? 'clinic-user-status--active'
                          : 'clinic-user-status--inactive'
                    }`}
                  >
                    {isInvitationPending
                      ? 'Pendiente'
                      : user.status === 'active'
                        ? 'Activo'
                        : 'Inactivo'}
                  </span>
                </div>
                {shouldShowOwnerEmailMigration && (
                  <button
                    className="secondary-action clinic-user-temporary-action"
                    type="button"
                    onClick={() => setIsOwnerEmailDialogOpen(true)}
                  >
                    Actualizar correo de acceso
                  </button>
                )}
                {canChangeLifecycle && !isLifecycleReviewOpen && (
                  <div className="clinic-user-actions">
                    <button
                      className={
                        targetStatus === 'inactive'
                          ? 'danger-action'
                          : 'secondary-action'
                      }
                      disabled={
                        targetStatus === 'active' && hasReachedLimit
                      }
                      onClick={() =>
                        openLifecycleReview(user, targetStatus)
                      }
                      type="button"
                    >
                      {targetStatus === 'active'
                        ? 'Reactivar'
                        : 'Desactivar'}
                    </button>
                    {targetStatus === 'active' && hasReachedLimit ? (
                      <span className="clinic-user-action-hint">
                        Libera un espacio del plan para reactivar.
                      </span>
                    ) : null}
                  </div>
                )}
                {isLifecycleReviewOpen && lifecycleDraft ? (
                  <form
                    className="clinic-user-lifecycle-review"
                    onSubmit={(event) => handleLifecycleSubmit(event, user)}
                  >
                    <div>
                      <h4>
                        {lifecycleDraft.targetStatus === 'active'
                          ? 'Reactivar acceso'
                          : 'Desactivar acceso'}
                      </h4>
                      <p>
                        {lifecycleDraft.targetStatus === 'active'
                          ? 'El usuario recuperará el acceso al consultorio.'
                          : 'El usuario conservará su cuenta y registros, pero ya no podrá ingresar al consultorio.'}
                      </p>
                    </div>
                    <label>
                      <span>Motivo</span>
                      <textarea
                        className="field-control field-control--textarea field-control--fixed-textarea"
                        aria-describedby={
                          lifecycleError
                            ? `clinic-user-lifecycle-error-${user.id}`
                            : undefined
                        }
                        aria-invalid={Boolean(lifecycleError)}
                        disabled={isUpdatingLifecycle}
                        maxLength={500}
                        placeholder={
                          lifecycleDraft.targetStatus === 'active'
                            ? 'Ej. Se reincorpora al equipo'
                            : 'Ej. Finalizó su relación con el consultorio'
                        }
                        rows={2}
                        value={lifecycleReason}
                        onChange={(event) => {
                          setLifecycleReason(event.target.value)
                          if (lifecycleError) setLifecycleError('')
                        }}
                      />
                    </label>
                    {lifecycleError ? (
                      <p
                        className="field-message field-message--error"
                        id={`clinic-user-lifecycle-error-${user.id}`}
                        role="alert"
                      >
                        {lifecycleError}
                      </p>
                    ) : null}
                    <div className="clinic-user-lifecycle-actions">
                      <button
                        className="secondary-action"
                        disabled={isUpdatingLifecycle}
                        onClick={closeLifecycleReview}
                        type="button"
                      >
                        Volver
                      </button>
                      <button
                        className={
                          lifecycleDraft.targetStatus === 'inactive'
                            ? 'danger-action'
                            : 'primary-action'
                        }
                        disabled={isUpdatingLifecycle}
                        type="submit"
                      >
                        {isUpdatingLifecycle
                          ? 'Guardando...'
                          : lifecycleDraft.targetStatus === 'active'
                            ? 'Confirmar reactivación'
                            : 'Confirmar desactivación'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            )
          })}
      </div>

      {isCurrentUserOnly && (
        <p className="settings-note">
          Actualmente solo tú tienes acceso a este consultorio.
        </p>
      )}

      {canManageUsers ? (
        <form className="clinic-user-form" noValidate onSubmit={handleSubmit}>
          <h3>Invitar usuario</h3>
          <label>
            <span>Nombre completo</span>
            <input
              aria-describedby={
                fieldErrors.fullName ? 'clinic-user-name-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.fullName)}
              disabled={hasReachedLimit || isSubmitting}
              value={formValues.fullName}
              onChange={(event) => {
                const fullName = event.target.value
                setFormValues((currentValues) => ({
                  ...currentValues,
                  fullName,
                }))

                if (fieldErrors.fullName) {
                  setFieldErrors(
                    validateClinicUserForm({ ...formValues, fullName }),
                  )
                }
              }}
            />
            {fieldErrors.fullName && (
              <small
                className="field-message field-message--error"
                id="clinic-user-name-error"
              >
                {fieldErrors.fullName}
              </small>
            )}
          </label>

          <label>
            <span>Email</span>
            <input
              aria-describedby={
                fieldErrors.email ? 'clinic-user-email-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.email)}
              inputMode="email"
              disabled={hasReachedLimit || isSubmitting}
              type="email"
              value={formValues.email}
              onChange={(event) => {
                const email = event.target.value
                setFormValues((currentValues) => ({
                  ...currentValues,
                  email,
                }))

                if (fieldErrors.email) {
                  setFieldErrors(
                    validateClinicUserForm({ ...formValues, email }),
                  )
                }
              }}
            />
            {fieldErrors.email && (
              <small
                className="field-message field-message--error"
                id="clinic-user-email-error"
              >
                {fieldErrors.email}
              </small>
            )}
          </label>

          <label>
            <span>Rol</span>
            <select
              disabled={hasReachedLimit || isSubmitting}
              value={formValues.role}
              onChange={(event) => {
                setFormValues((currentValues) => ({
                  ...currentValues,
                  role: event.target.value as ClinicUserFormValues['role'],
                }))
              }}
            >
              {clinicUserRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {formMessage && <p className="settings-note">{formMessage}</p>}

          {hasReachedLimit && (
            <p className="field-message field-message--error">
              Tu plan alcanzó el límite de usuarios.
            </p>
          )}

          <button
            className="primary-action"
            disabled={hasReachedLimit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Invitando...' : 'Invitar usuario'}
          </button>
        </form>
      ) : (
        <p className="settings-note">
          Solo un administrador del consultorio puede agregar usuarios.
        </p>
      )}
      <Toast message={toastMessage} tone={toastTone} visible={isToastVisible} />
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel={
          isMigratingOwnerEmail ? 'Actualizando...' : 'Actualizar correo'
        }
        isOpen={isOwnerEmailDialogOpen}
        message="Esta acción temporal cambiará el correo de acceso del usuario administrador actual a pereezcharles@gmail.com sin cambiar su UID ni sus datos del consultorio."
        title="Actualizar correo de acceso"
        variant="warning"
        onCancel={() => {
          if (!isMigratingOwnerEmail) {
            setIsOwnerEmailDialogOpen(false)
          }
        }}
        onConfirm={handleConfirmOwnerEmailMigration}
      />
    </section>
  )
}

function formatClinicUserDate(value: string) {
  return formatAppDate(value.slice(0, 10))
}
