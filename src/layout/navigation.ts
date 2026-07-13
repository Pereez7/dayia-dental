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
  { id: 'clinical-history', label: 'Historial clinico' },
  { id: 'odontogram', label: 'Odontograma' },
  { id: 'whatsapp-reminders', label: 'Recordatorios' },
  { id: 'settings', label: 'Configuracion' },
]

export const administrationNavigationItem: NavigationItem = {
  id: 'administration',
  label: 'Administracion DayIA',
}

export const quickActions: NavigationItem[] = [
  { id: 'patient-new', label: '+ Paciente' },
  { id: 'appointment-new', label: '+ Cita' },
]
