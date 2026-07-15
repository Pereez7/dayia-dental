interface DashboardPanelSkeletonProps {
  label: string
  rows?: number
}

export function DashboardPanelSkeleton({
  label,
  rows = 3,
}: DashboardPanelSkeletonProps) {
  return (
    <div
      className="dashboard-panel-skeleton"
      aria-label={label}
      aria-live="polite"
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <span aria-hidden="true" key={index} />
      ))}
      <span className="sr-only">Cargando información del consultorio.</span>
    </div>
  )
}
