import type { DashboardActivityItem } from '../utils/dashboardMetrics'
import { formatDashboardActivityDate } from '../utils/dashboardMetrics'

interface DashboardActivityListProps {
  activities: DashboardActivityItem[]
}

export function DashboardActivityList({
  activities,
}: DashboardActivityListProps) {
  if (activities.length === 0) {
    return (
      <p className="dashboard-empty-state">
        No hay actividad reciente relevante.
      </p>
    )
  }

  return (
    <div className="dashboard-activity-list">
      {activities.map((activity) => (
        <article className="dashboard-activity-row" key={activity.id}>
          <span>{formatDashboardActivityDate(activity.occurredAt)}</span>
          <p>
            {activity.patient} · {activity.description}
          </p>
        </article>
      ))}
    </div>
  )
}
