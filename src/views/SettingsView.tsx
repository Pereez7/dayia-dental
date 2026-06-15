import { BusinessHoursSettings } from '../components/BusinessHoursSettings'
import { TreatmentsSettings } from '../components/TreatmentsSettings'
import type {
  BusinessHoursSettings as BusinessHoursSettingsType,
  CalendarException,
} from '../types/BusinessHours'
import type { Treatment } from '../types/Treatment'

interface SettingsViewProps {
  businessHours: BusinessHoursSettingsType
  calendarExceptions: CalendarException[]
  onCalendarExceptionsChange: (exceptions: CalendarException[]) => void
  onBusinessHoursChange: (settings: BusinessHoursSettingsType) => void
  treatments: Treatment[]
  onTreatmentsChange: (treatments: Treatment[]) => void
}

export function SettingsView({
  businessHours,
  calendarExceptions,
  onCalendarExceptionsChange,
  onBusinessHoursChange,
  treatments,
  onTreatmentsChange,
}: SettingsViewProps) {
  return (
    <section className="view-stack settings-grid">
      <BusinessHoursSettings
        calendarExceptions={calendarExceptions}
        settings={businessHours}
        onCalendarExceptionsChange={onCalendarExceptionsChange}
        onSettingsChange={onBusinessHoursChange}
      />
      <TreatmentsSettings
        treatments={treatments}
        onTreatmentsChange={onTreatmentsChange}
      />
    </section>
  )
}
