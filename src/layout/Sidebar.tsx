import type { ClinicalPermissions } from '../auth/permissions'
import type { AppSection } from './navigation'
import {
  getVisibleNavigationItems,
  getVisibleQuickActions,
} from './navigation'
import { SessionSummary } from './SessionSummary'

interface SidebarProps {
  activeSection: AppSection
  canAccessAdministration?: boolean
  permissions: ClinicalPermissions
  onSectionChange: (section: AppSection) => void
}

export function Sidebar({
  activeSection,
  canAccessAdministration = false,
  onSectionChange,
  permissions,
}: SidebarProps) {
  const visibleNavigationItems = getVisibleNavigationItems(
    permissions,
    canAccessAdministration,
  )
  const visibleQuickActions = getVisibleQuickActions(permissions)

  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="sidebar-brand-card">
        <div className="sidebar-brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>DayIA Dental</strong>
            <span>Consultorio inteligente</span>
          </div>
        </div>
      </div>

      <SessionSummary
        canAccessSubscription={permissions.canAccessSubscription}
        isSubscriptionActive={activeSection === 'subscription'}
        onOpenSubscription={() => onSectionChange('subscription')}
      />

      {!canAccessAdministration && visibleQuickActions.length > 0 && (
        <section className="sidebar-section" aria-label="Acciones rápidas">
          <p className="sidebar-section-label">Acciones</p>
          <div className="quick-actions">
            {visibleQuickActions.map((action) => (
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

      <section className="sidebar-section" aria-label="Módulos principales">
        <p className="sidebar-section-label">Módulos</p>
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
