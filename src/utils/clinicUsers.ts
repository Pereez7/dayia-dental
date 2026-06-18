import type {
  ClinicUserFormErrors,
  ClinicUserFormValues,
  ClinicUserRole,
} from '../types/ClinicUser'
import type { UserRole } from '../types/database'
import { normalizeUserRole } from '../auth/permissions'
import { normalizeSentenceText } from './textNormalizers'

export const clinicUserRoleOptions: Array<{
  label: string
  value: ClinicUserRole
}> = [
  { label: 'Administrador', value: 'clinic_admin' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Recepción', value: 'receptionist' },
]

const clinicUserRoleLabels: Record<UserRole, string> = {
  clinic_admin: 'Administrador',
  doctor: 'Doctor',
  receptionist: 'Recepción',
  super_admin: 'Super administrador',
}

const allowedClinicUserRoles = clinicUserRoleOptions.map(
  (option) => option.value,
)

export function getClinicUserRoleLabel(role: string | null | undefined) {
  return clinicUserRoleLabels[normalizeUserRole(role)]
}

export function normalizeClinicUserEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeClinicUserFullName(fullName: string) {
  return normalizeSentenceText(fullName)
}

export function validateClinicUserForm(values: ClinicUserFormValues) {
  const errors: ClinicUserFormErrors = {}
  const fullName = values.fullName.trim()
  const email = normalizeClinicUserEmail(values.email)

  if (!fullName) {
    errors.fullName = 'Ingresa el nombre completo.'
  } else if (fullName.length < 3) {
    errors.fullName = 'El nombre debe tener al menos 3 caracteres.'
  }

  if (!email) {
    errors.email = 'Ingresa el email del usuario.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Ingresa un email válido.'
  }

  if (!allowedClinicUserRoles.includes(values.role)) {
    errors.role = 'Selecciona un rol válido.'
  }

  return errors
}

export function hasClinicUserFormErrors(errors: ClinicUserFormErrors) {
  return Boolean(errors.fullName || errors.email || errors.role)
}
