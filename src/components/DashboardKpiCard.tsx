interface DashboardKpiCardProps {
  label: string
  tone: 'amber' | 'blue' | 'green' | 'indigo' | 'red' | 'slate'
  value: number | string
}

export function DashboardKpiCard({ label, tone, value }: DashboardKpiCardProps) {
  return (
    <article className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
