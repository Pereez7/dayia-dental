import { BusinessHoursSettings } from '../components/BusinessHoursSettings'
import { TreatmentsSettings } from '../components/TreatmentsSettings'
import type {
  BusinessHoursSettings as BusinessHoursSettingsType,
  CalendarException,
  CalendarExceptionFormValues,
  CalendarExceptionId,
} from '../types/BusinessHours'
import type { Treatment, TreatmentId } from '../types/Treatment'

interface SettingsActionResult {
  error?: string
  success: boolean
}

interface SettingsViewProps {
  businessHours: BusinessHoursSettingsType
  calendarExceptions: CalendarException[]
  businessHoursError?: string
  isBusinessHoursConfigured?: boolean
  onBusinessHoursChange: (
    settings: BusinessHoursSettingsType,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  onCreateCalendarException: (
    values: CalendarExceptionFormValues,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  onCreateTreatment: (
    treatment: Omit<Treatment, 'id'>,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  onDeleteCalendarException: (
    exceptionId: CalendarExceptionId,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  onSetTreatmentActive: (
    treatmentId: TreatmentId,
    isActive: boolean,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  onUpdateTreatment: (
    treatmentId: TreatmentId,
    treatment: Omit<Treatment, 'id'>,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  settingsError?: string
  treatmentsError?: string
  treatments: Treatment[]
}

export function SettingsView({
  businessHours,
  calendarExceptions,
  businessHoursError = '',
  onBusinessHoursChange,
  onCreateCalendarException,
  onCreateTreatment,
  onDeleteCalendarException,
  onSetTreatmentActive,
  onUpdateTreatment,
  isBusinessHoursConfigured = true,
  settingsError = '',
  treatmentsError = '',
  treatments,
}: SettingsViewProps) {
  const businessHoursKey = [
    businessHours.appointmentInterval,
    ...businessHours.weeklySchedule.map(
      (day) =>
        `${day.day}:${day.isOpen ? 'open' : 'closed'}:${day.startTime}-${day.endTime}`,
    ),
  ].join('|')

  return (
    <section className="view-stack settings-grid">
      <BusinessHoursSettings
        key={businessHoursKey}
        calendarExceptions={calendarExceptions}
        errorMessage={businessHoursError || settingsError}
        isBusinessHoursConfigured={isBusinessHoursConfigured}
        settings={businessHours}
        onCreateCalendarException={onCreateCalendarException}
        onDeleteCalendarException={onDeleteCalendarException}
        onSettingsChange={onBusinessHoursChange}
      />
      <TreatmentsSettings
        errorMessage={treatmentsError || settingsError}
        treatments={treatments}
        onCreateTreatment={onCreateTreatment}
        onSetTreatmentActive={onSetTreatmentActive}
        onUpdateTreatment={onUpdateTreatment}
      />
    </section>
  )
}
