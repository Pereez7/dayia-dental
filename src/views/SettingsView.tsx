import { BusinessHoursSettings } from '../components/BusinessHoursSettings'
import { TreatmentsSettings } from '../components/TreatmentsSettings'
import type { BusinessHoursSettings as BusinessHoursSettingsType } from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'

interface SettingsViewProps {
  businessHours: BusinessHoursSettingsType
  onBusinessHoursChange: (settings: BusinessHoursSettingsType) => void
  treatments: Treatment[]
  onTreatmentsChange: (treatments: Treatment[]) => void
}

export function SettingsView({
  businessHours,
  onBusinessHoursChange,
  treatments,
  onTreatmentsChange,
}: SettingsViewProps) {
  return (
    <section className="view-stack settings-grid">
      <BusinessHoursSettings
        settings={businessHours}
        onSettingsChange={onBusinessHoursChange}
      />
      <TreatmentsSettings
        treatments={treatments}
        onTreatmentsChange={onTreatmentsChange}
      />
    </section>
  )
}
