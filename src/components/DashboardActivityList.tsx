interface DashboardActivityListProps {
  messages: string[]
}

export function DashboardActivityList({ messages }: DashboardActivityListProps) {
  return (
    <div className="dashboard-activity-list">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  )
}
