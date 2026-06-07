import type { AppSection } from './navigation'
import { navigationItems, quickActions } from './navigation'

interface SidebarProps {
  activeSection: AppSection
  onSectionChange: (section: AppSection) => void
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Navegacion principal">
      <div className="sidebar-brand">
        <div className="brand-mark">D</div>
        <div>
          <strong>DayIA Dental</strong>
          <span>Consultorio inteligente</span>
        </div>
      </div>

      <div className="quick-actions" aria-label="Acciones rapidas">
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

      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
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
    </aside>
  )
}
