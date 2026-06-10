import type { ReactNode } from 'react'
import { Header } from './Header'
import type { AppSection } from './navigation'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  activeSection: AppSection
  children: ReactNode
  onSectionChange: (section: AppSection) => void
}

export function AppLayout({
  activeSection,
  children,
  onSectionChange,
}: AppLayoutProps) {
  return (
    <div className="app-layout" data-section={activeSection}>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
      <div className="main-area">
        <Header activeSection={activeSection} />
        <main className="view-shell">{children}</main>
      </div>
    </div>
  )
}
