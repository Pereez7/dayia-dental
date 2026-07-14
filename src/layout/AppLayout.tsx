import type { ReactNode } from 'react'
import type { ClinicalPermissions } from '../auth/permissions'
import { Header } from './Header'
import type { AppSection } from './navigation'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  activeSection: AppSection
  canAccessAdministration?: boolean
  children: ReactNode
  onSectionChange: (section: AppSection) => void
  permissions: ClinicalPermissions
}

export function AppLayout({
  activeSection,
  canAccessAdministration = false,
  children,
  onSectionChange,
  permissions,
}: AppLayoutProps) {
  return (
    <div className="app-layout" data-section={activeSection}>
      <Sidebar
        activeSection={activeSection}
        canAccessAdministration={canAccessAdministration}
        onSectionChange={onSectionChange}
        permissions={permissions}
      />
      <div className="main-area">
        <Header activeSection={activeSection} />
        <main className="view-shell">{children}</main>
      </div>
    </div>
  )
}
