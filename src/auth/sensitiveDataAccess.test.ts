import { describe, expect, it, vi } from 'vitest'

import { getClinicalPermissions } from './permissions'
import {
  getSensitiveDataAccess,
  runSensitiveLoader,
} from './sensitiveDataAccess'

describe('sensitive data access', () => {
  it('blocks every sensitive loader for reception', () => {
    expect(
      getSensitiveDataAccess(
        getClinicalPermissions('receptionist', 'pro'),
      ),
    ).toEqual({
      canLoadClinicUsers: false,
      canLoadClinicalRecords: false,
      canLoadOdontogram: false,
      canLoadWhatsappSettings: false,
    })
  })

  it('does not call clinical or clinic-management services for reception', async () => {
    const access = getSensitiveDataAccess(
      getClinicalPermissions('receptionist', 'pro'),
    )
    const clinicalRecordsService = vi.fn().mockResolvedValue([])
    const odontogramService = vi.fn().mockResolvedValue([])
    const clinicUsersService = vi.fn().mockResolvedValue([])
    const whatsappSettingsService = vi.fn().mockResolvedValue(null)

    await runSensitiveLoader(
      access.canLoadClinicalRecords,
      clinicalRecordsService,
    )
    await runSensitiveLoader(access.canLoadOdontogram, odontogramService)
    await runSensitiveLoader(access.canLoadClinicUsers, clinicUsersService)
    await runSensitiveLoader(
      access.canLoadWhatsappSettings,
      whatsappSettingsService,
    )

    expect(clinicalRecordsService).not.toHaveBeenCalled()
    expect(odontogramService).not.toHaveBeenCalled()
    expect(clinicUsersService).not.toHaveBeenCalled()
    expect(whatsappSettingsService).not.toHaveBeenCalled()
  })

  it('blocks clinical loaders for a pure platform administrator', () => {
    const access = getSensitiveDataAccess(
      getClinicalPermissions('platform_admin', 'pro'),
    )

    expect(access.canLoadClinicalRecords).toBe(false)
    expect(access.canLoadOdontogram).toBe(false)
    expect(access.canLoadClinicUsers).toBe(false)
  })

  it('allows doctors to load history and odontogram only', () => {
    expect(
      getSensitiveDataAccess(getClinicalPermissions('doctor', 'basic')),
    ).toEqual({
      canLoadClinicUsers: false,
      canLoadClinicalRecords: true,
      canLoadOdontogram: true,
      canLoadWhatsappSettings: false,
    })
  })

  it('allows a Pro owner to load every authorized clinic scope', () => {
    expect(
      getSensitiveDataAccess(getClinicalPermissions('clinic_owner', 'pro')),
    ).toEqual({
      canLoadClinicUsers: true,
      canLoadClinicalRecords: true,
      canLoadOdontogram: true,
      canLoadWhatsappSettings: true,
    })
  })
})
