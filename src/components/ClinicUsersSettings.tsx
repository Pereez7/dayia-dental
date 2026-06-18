import { useMemo, useState, type FormEvent } from 'react'

import type {
  ClinicUser,
  ClinicUserFormErrors,
  ClinicUserFormValues,
} from '../types/ClinicUser'
import {
  clinicUserRoleOptions,
  getClinicUserRoleLabel,
  hasClinicUserFormErrors,
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
  validateClinicUserForm,
} from '../utils/clinicUsers'

interface ClinicUsersSettingsProps {
  canManageUsers: boolean
  currentUserId?: string | null
  errorMessage?: string
  isLoading?: boolean
  onCreateUser: (
    values: ClinicUserFormValues,
  ) =>
    | Promise<{ error?: string; success: boolean }>
    | { error?: string; success: boolean }
  users: ClinicUser[]
}

const initialFormValues: ClinicUserFormValues = {
  email: '',
  fullName: '',
  role: 'doctor',
}

export function ClinicUsersSettings({
  canManageUsers,
  currentUserId,
  errorMessage = '',
  isLoading = false,
  onCreateUser,
  users,
}: ClinicUsersSettingsProps) {
  const [fieldErrors, setFieldErrors] = useState<ClinicUserFormErrors>({})
  const [formValues, setFormValues] =
    useState<ClinicUserFormValues>(initialFormValues)
  const [formMessage, setFormMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedUsers = useMemo(
    () =>
      [...users].sort((firstUser, secondUser) =>
        firstUser.fullName.localeCompare(secondUser.fullName, 'es'),
      ),
    [users],
  )
  const isCurrentUserOnly =
    sortedUsers.length === 1 && sortedUsers[0]?.id === currentUserId

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateClinicUserForm(formValues)
    setFieldErrors(nextErrors)
    setFormMessage('')

    if (hasClinicUserFormErrors(nextErrors)) {
      return
    }

    setIsSubmitting(true)
    const result = await onCreateUser({
      email: normalizeClinicUserEmail(formValues.email),
      fullName: normalizeClinicUserFullName(formValues.fullName),
      role: formValues.role,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setFormMessage(result.error ?? 'No pudimos crear el usuario.')
      return
    }

    setFormValues(initialFormValues)
    setFieldErrors({})
    setFormMessage('Usuario preparado correctamente.')
  }

  return (
    <section className="settings-panel clinic-users-panel">
      <div className="section-heading">
        <h2>Usuarios del consultorio</h2>
        <p className="section-description">
          Administra quién puede acceder a este consultorio. Si trabajas solo,
          no necesitas agregar más usuarios.
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
          sortedUsers.map((user) => (
            <article className="clinic-user-row" key={user.id}>
              <div className="clinic-user-main">
                <div className="clinic-user-title-row">
                  <h3>{user.fullName}</h3>
                  {user.id === currentUserId && (
                    <span className="clinic-user-you">Tú</span>
                  )}
                </div>
                <p>{user.email || 'Email pendiente'}</p>
                <span>
                  {user.createdAt
                    ? `Creado el ${formatClinicUserDate(user.createdAt)}`
                    : 'Fecha de creación pendiente'}
                </span>
              </div>
              <div className="clinic-user-badges">
                <span className="clinic-user-role">
                  {getClinicUserRoleLabel(user.role)}
                </span>
                <span
                  className={`clinic-user-status ${
                    user.isActive
                      ? 'clinic-user-status--active'
                      : 'clinic-user-status--inactive'
                  }`}
                >
                  {user.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </article>
          ))}
      </div>

      {isCurrentUserOnly && (
        <p className="settings-note">
          Actualmente solo tú tienes acceso a este consultorio.
        </p>
      )}

      {canManageUsers ? (
        <form className="clinic-user-form" noValidate onSubmit={handleSubmit}>
          <h3>Agregar usuario</h3>
          <label>
            <span>Nombre completo</span>
            <input
              aria-describedby={
                fieldErrors.fullName ? 'clinic-user-name-error' : undefined
              }
              aria-invalid={Boolean(fieldErrors.fullName)}
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

          <button
            className="primary-action"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Agregando...' : 'Agregar usuario'}
          </button>
        </form>
      ) : (
        <p className="settings-note">
          Solo un administrador del consultorio puede agregar usuarios.
        </p>
      )}
    </section>
  )
}

function formatClinicUserDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'fecha pendiente'
  }

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
