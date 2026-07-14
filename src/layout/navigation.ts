import type { ClinicalPermissions } from '../auth/permissions'

export type AppSection =
  | 'dashboard'
  | 'patients-list'
  | 'patient-detail'
  | 'patient-new'
  | 'appointments-agenda'
  | 'appointment-new'
  | 'clinical-history'
  | 'odontogram'
  | 'whatsapp-reminders'
  | 'administration'
  | 'settings'

export interface NavigationItem {
  id: AppSection
  label: string
}

export const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'patients-list', label: 'Pacientes' },
  { id: 'appointments-agenda', label: 'Citas' },
  { id: 'clinical-history', label: 'Historial clínico' },
  { id: 'odontogram', label: 'Odontograma' },
  { id: 'whatsapp-reminders', label: 'Recordatorios' },
  { id: 'settings', label: 'Configuración' },
]

export const administrationNavigationItem: NavigationItem = {
  id: 'administration',
  label: 'Administración DayIA',
}

export const quickActions: NavigationItem[] = [
  { id: 'patient-new', label: '+ Paciente' },
  { id: 'appointment-new', label: '+ Cita' },
]

export function getVisibleNavigationItems(
  permissions: ClinicalPermissions,
  canAccessAdministration: boolean,
) {
  if (canAccessAdministration) {
    return [administrationNavigationItem]
  }

  return navigationItems.filter((item) =>
    canAccessAppSection(item.id, permissions, false),
  )
}

export function getVisibleQuickActions(permissions: ClinicalPermissions) {
  return quickActions.filter((action) =>
    canAccessAppSection(action.id, permissions, false),
  )
}

export function canAccessAppSection(
  section: AppSection,
  permissions: ClinicalPermissions,
  canAccessAdministration: boolean,
) {
  if (section === 'administration') {
    return canAccessAdministration
  }

  if (section === 'dashboard') {
    return permissions.canAccessDashboard
  }

  if (
    section === 'patients-list' ||
    section === 'patient-new' ||
    section === 'patient-detail'
  ) {
    return permissions.canAccessPatients
  }

  if (section === 'appointments-agenda' || section === 'appointment-new') {
    return permissions.canAccessAppointments
  }

  if (section === 'clinical-history') {
    return permissions.canAccessClinicalHistory
  }

  if (section === 'odontogram') {
    return permissions.canAccessOdontogram
  }

  if (section === 'whatsapp-reminders') {
    return permissions.canAccessReminders
  }

  return permissions.canAccessSettings
}

export function getAuthorizedSection(
  requestedSection: AppSection,
  permissions: ClinicalPermissions,
  canAccessAdministration: boolean,
): AppSection {
  if (canAccessAdministration) {
    return 'administration'
  }

  if (canAccessAppSection(requestedSection, permissions, false)) {
    return requestedSection
  }

  return 'dashboard'
}
