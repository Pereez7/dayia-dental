import { TreatmentsSettings } from '../components/TreatmentsSettings'
import type { Treatment } from '../types/Treatment'

interface SettingsViewProps {
  treatments: Treatment[]
  onTreatmentsChange: (treatments: Treatment[]) => void
}

export function SettingsView({
  treatments,
  onTreatmentsChange,
}: SettingsViewProps) {
  return (
    <section className="view-stack">
      <TreatmentsSettings
        treatments={treatments}
        onTreatmentsChange={onTreatmentsChange}
      />
    </section>
  )
}
