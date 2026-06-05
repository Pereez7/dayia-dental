interface StatsCardProps {
  value: number | string
  label: string
}

export function StatsCard({ value, label }: StatsCardProps) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
