interface StatsCardProps {
  value: number | string
  label: string
}

export function StatsCard({ value, label }: StatsCardProps) {
  return (
    <div className="ui-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
