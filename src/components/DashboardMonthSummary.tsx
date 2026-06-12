import type { DashboardMonthlySummary } from '../utils/dashboardMetrics'

interface DashboardMonthSummaryProps {
  summary: DashboardMonthlySummary
}

export function DashboardMonthSummary({ summary }: DashboardMonthSummaryProps) {
  const items = [
    { label: 'Total', value: summary.total },
    { label: 'Confirmadas', value: summary.confirmed },
    { label: 'Canceladas', value: summary.cancelled },
    { label: 'Reprogramadas', value: summary.rescheduled },
  ]

  return (
    <div className="dashboard-month-summary">
      {items.map((item) => (
        <div key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
