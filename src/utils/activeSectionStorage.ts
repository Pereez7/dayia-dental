import type { AppSection } from '../layout/navigation'

const activeSectionStorageKey = 'dayia-dental.active-section'

const defaultActiveSection: AppSection = 'dashboard'

const restorableSections = new Set<AppSection>([
  'dashboard',
  'patients-list',
  'patient-new',
  'appointments-agenda',
  'appointment-new',
  'clinical-history',
  'odontogram',
  'whatsapp-reminders',
  'settings',
])

export function getRestorableActiveSection(section: AppSection): AppSection {
  if (section === 'patient-detail') {
    return 'patients-list'
  }

  return section
}

export function getStoredActiveSection(): AppSection {
  if (!canUseSessionStorage()) {
    return defaultActiveSection
  }

  const storedSection = window.sessionStorage.getItem(activeSectionStorageKey)

  if (isRestorableSection(storedSection)) {
    return storedSection
  }

  return defaultActiveSection
}

export function saveActiveSection(section: AppSection) {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.setItem(
    activeSectionStorageKey,
    getRestorableActiveSection(section),
  )
}

export function clearStoredActiveSection() {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.removeItem(activeSectionStorageKey)
}

function isRestorableSection(section: string | null): section is AppSection {
  return restorableSections.has(section as AppSection)
}

function canUseSessionStorage() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return Boolean(window.sessionStorage)
  } catch {
    return false
  }
}
