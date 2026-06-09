interface ReminderKpiCardProps {
  label: string
  tone: 'amber' | 'blue' | 'green' | 'red' | 'slate'
  value: number
}

export function ReminderKpiCard({ label, tone, value }: ReminderKpiCardProps) {
  return (
    <article className={`dashboard-kpi dashboard-kpi--${tone} reminder-kpi-card`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}
