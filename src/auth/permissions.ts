import type { UserRole } from '../types/database'

const legacyRoleMap: Record<string, UserRole> = {
  admin: 'clinic_admin',
  clinic_admin: 'clinic_admin',
  dentist: 'doctor',
  doctor: 'doctor',
  owner: 'clinic_admin',
  reception: 'receptionist',
  receptionist: 'receptionist',
  super_admin: 'super_admin',
}

const roleLabels: Record<UserRole, string> = {
  clinic_admin: 'Administrador del consultorio',
  doctor: 'Doctor',
  receptionist: 'Recepcionista',
  super_admin: 'Super admin',
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (!role) {
    return 'clinic_admin'
  }

  return legacyRoleMap[role] ?? 'clinic_admin'
}

export function getUserRoleLabel(role: string | null | undefined) {
  return roleLabels[normalizeUserRole(role)]
}

export function canManageClinicSettings(role: string | null | undefined) {
  return ['clinic_admin', 'super_admin'].includes(normalizeUserRole(role))
}

export function canManageUsers(role: string | null | undefined) {
  return ['clinic_admin', 'super_admin'].includes(normalizeUserRole(role))
}

export function canManageWhatsapp(role: string | null | undefined) {
  return ['clinic_admin', 'super_admin'].includes(normalizeUserRole(role))
}

export function canManageAppointments(role: string | null | undefined) {
  return [
    'clinic_admin',
    'doctor',
    'receptionist',
    'super_admin',
  ].includes(normalizeUserRole(role))
}

export function canManagePatients(role: string | null | undefined) {
  return [
    'clinic_admin',
    'doctor',
    'receptionist',
    'super_admin',
  ].includes(normalizeUserRole(role))
}

export function canViewClinicalRecords(role: string | null | undefined) {
  return ['clinic_admin', 'doctor', 'super_admin'].includes(
    normalizeUserRole(role),
  )
}
