import { describe, expect, it } from 'vitest'

import type { WhatsAppSettingsRecord } from '../types/database'
import {
  getWhatsappConnectionStatus,
  mapWhatsappSettingsInputToInsert,
  mapWhatsappSettingsRecordToSettings,
} from './whatsappSettingsService'

const whatsappSettingsRecord: WhatsAppSettingsRecord = {
  business_account_id: 'business-1',
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  id: 'settings-1',
  is_connected: true,
  phone_number: '+59170012345',
  phone_number_id: 'phone-number-1',
  provider: 'whatsapp_cloud_api',
  updated_at: '2026-06-16T12:00:00Z',
}

describe('whatsappSettingsService mappers', () => {
  it('maps non-secret WhatsApp settings records to frontend settings', () => {
    expect(mapWhatsappSettingsRecordToSettings(whatsappSettingsRecord)).toEqual({
      businessAccountId: 'business-1',
      id: 'settings-1',
      isConnected: true,
      phoneNumber: '+59170012345',
      phoneNumberId: 'phone-number-1',
      provider: 'whatsapp_cloud_api',
    })
  })

  it('maps settings input to a clinic-scoped insert without tokens', () => {
    expect(
      mapWhatsappSettingsInputToInsert('clinic-1', {
        businessAccountId: ' business-1 ',
        isConnected: false,
        phoneNumber: ' +59170012345 ',
        phoneNumberId: ' phone-number-1 ',
        provider: 'whatsapp_cloud_api',
      }),
    ).toEqual({
      business_account_id: 'business-1',
      clinic_id: 'clinic-1',
      is_connected: false,
      phone_number: '+59170012345',
      phone_number_id: 'phone-number-1',
      provider: 'whatsapp_cloud_api',
    })
  })

  it('derives a connection status from visible settings', () => {
    expect(getWhatsappConnectionStatus(null)).toBe('not-configured')
    expect(
      getWhatsappConnectionStatus({
        businessAccountId: '',
        isConnected: false,
        phoneNumber: '+59170012345',
        phoneNumberId: '',
        provider: 'whatsapp_cloud_api',
      }),
    ).toBe('pending')
    expect(
      getWhatsappConnectionStatus({
        businessAccountId: 'business-1',
        isConnected: true,
        phoneNumber: '+59170012345',
        phoneNumberId: 'phone-number-1',
        provider: 'whatsapp_cloud_api',
      }),
    ).toBe('connected')
  })
})
