export type WhatsappProvider = 'whatsapp_cloud_api'

export type WhatsappConnectionStatus =
  | 'connected'
  | 'error'
  | 'not-configured'
  | 'pending'

export interface WhatsappSettings {
  businessAccountId: string
  id?: string
  isConnected: boolean
  phoneNumber: string
  phoneNumberId: string
  provider: WhatsappProvider
}

export interface WhatsappSettingsFormValues {
  businessAccountId: string
  isConnected: boolean
  phoneNumber: string
  phoneNumberId: string
  provider: WhatsappProvider
}
