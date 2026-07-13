import type { AppSection } from './navigation'
import {
  administrationNavigationItem,
  navigationItems,
  quickActions,
} from './navigation'
import { SessionSummary } from './SessionSummary'

interface SidebarProps {
  activeSection: AppSection
  canAccessAdministration?: boolean
  onSectionChange: (section: AppSection) => void
}

export function Sidebar({
  activeSection,
  canAccessAdministration = false,
  onSectionChange,
}: SidebarProps) {
  const visibleNavigationItems = canAccessAdministration
    ? [administrationNavigationItem]
    : navigationItems

  return (
    <aside className="sidebar" aria-label="Navegacion principal">
      <div className="sidebar-brand-card">
        <div className="sidebar-brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>DayIA Dental</strong>
            <span>Consultorio inteligente</span>
          </div>
        </div>
      </div>

      <SessionSummary />

      {!canAccessAdministration && (
        <section className="sidebar-section" aria-label="Acciones rapidas">
          <p className="sidebar-section-label">Acciones</p>
          <div className="quick-actions">
            {quickActions.map((action) => (
              <button
                className="quick-action"
                key={action.id}
                onClick={() => onSectionChange(action.id)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="sidebar-section" aria-label="Modulos principales">
        <p className="sidebar-section-label">Modulos</p>
        <nav className="sidebar-nav">
          {visibleNavigationItems.map((item) => (
            <button
              aria-current={activeSection === item.id ? 'page' : undefined}
              className="sidebar-link"
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>
    </aside>
  )
}
