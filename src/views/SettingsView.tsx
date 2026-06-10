import { BusinessHoursSettings } from '../components/BusinessHoursSettings'
import { TreatmentsSettings } from '../components/TreatmentsSettings'
import { businessHours } from '../data/businessHours'
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
    <section className="view-stack settings-grid">
      <BusinessHoursSettings initialSettings={businessHours} />
      <TreatmentsSettings
        treatments={treatments}
        onTreatmentsChange={onTreatmentsChange}
      />
    </section>
  )
}
