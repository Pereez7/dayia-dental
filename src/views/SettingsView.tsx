import { BusinessHoursSettings } from '../components/BusinessHoursSettings'
import { TreatmentsSettings } from '../components/TreatmentsSettings'
import { WhatsappSettingsPanel } from '../components/WhatsappSettingsPanel'
import type {
  BusinessHoursSettings as BusinessHoursSettingsType,
  CalendarException,
  CalendarExceptionFormValues,
  CalendarExceptionId,
} from '../types/BusinessHours'
import type { Treatment, TreatmentId } from '../types/Treatment'
import type {
  WhatsappSettings,
  WhatsappSettingsFormValues,
} from '../types/WhatsApp'

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
  onWhatsappSettingsChange: (
    values: WhatsappSettingsFormValues,
  ) => Promise<SettingsActionResult> | SettingsActionResult
  settingsError?: string
  treatmentsError?: string
  treatments: Treatment[]
  whatsappSettings: WhatsappSettings | null
  whatsappSettingsError?: string
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
  onWhatsappSettingsChange,
  isBusinessHoursConfigured = true,
  settingsError = '',
  treatmentsError = '',
  treatments,
  whatsappSettings,
  whatsappSettingsError = '',
}: SettingsViewProps) {
  const businessHoursKey = [
    businessHours.appointmentInterval,
    ...businessHours.weeklySchedule.map(
      (day) =>
        `${day.day}:${day.isOpen ? 'open' : 'closed'}:${day.startTime}-${day.endTime}`,
    ),
  ].join('|')
  const whatsappSettingsKey = whatsappSettings
    ? [
        whatsappSettings.phoneNumber,
        whatsappSettings.phoneNumberId,
        whatsappSettings.businessAccountId,
        whatsappSettings.isConnected ? 'connected' : 'pending',
      ].join('|')
    : 'not-configured'

  return (
    <section className="view-stack settings-grid">
      <div className="settings-column settings-column--left">
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
        <WhatsappSettingsPanel
          key={whatsappSettingsKey}
          errorMessage={whatsappSettingsError || settingsError}
          settings={whatsappSettings}
          onSaveSettings={onWhatsappSettingsChange}
        />
      </div>

      <div className="settings-column settings-column--right">
        <TreatmentsSettings
          errorMessage={treatmentsError || settingsError}
          treatments={treatments}
          onCreateTreatment={onCreateTreatment}
          onSetTreatmentActive={onSetTreatmentActive}
          onUpdateTreatment={onUpdateTreatment}
        />
      </div>
    </section>
  )
}
