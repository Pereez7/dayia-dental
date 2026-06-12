import type { DashboardAttentionItem } from '../utils/dashboardMetrics'

interface DashboardAttentionListProps {
  items: DashboardAttentionItem[]
}

export function DashboardAttentionList({ items }: DashboardAttentionListProps) {
  if (items.length === 0) {
    return (
      <p className="dashboard-empty-state">
        No hay citas que requieran seguimiento inmediato.
      </p>
    )
  }

  return (
    <div className="dashboard-attention-list">
      {items.map((item) => (
        <article
          className={`dashboard-attention-row dashboard-attention-row--${item.tone}`}
          key={item.id}
        >
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </article>
      ))}
    </div>
  )
}
