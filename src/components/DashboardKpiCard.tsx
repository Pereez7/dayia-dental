interface DashboardKpiCardProps {
  isLoading?: boolean
  label: string
  tone: 'amber' | 'blue' | 'green' | 'indigo' | 'red' | 'slate'
  value: number | string
}

export function DashboardKpiCard({
  isLoading = false,
  label,
  tone,
  value,
}: DashboardKpiCardProps) {
  return (
    <article
      className={`dashboard-kpi dashboard-kpi--${tone}${
        isLoading ? ' dashboard-kpi--loading' : ''
      }`}
      aria-busy={isLoading}
    >
      <strong>{isLoading ? '—' : value}</strong>
      <span>{label}</span>
    </article>
  )
}
