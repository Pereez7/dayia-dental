import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { businessHours } from '../data/businessHours'
import { calendarExceptions } from '../data/calendarExceptions'
import { treatments } from '../data/treatments'
import { SettingsView } from './SettingsView'

const successfulAction = vi.fn().mockResolvedValue({ success: true })

function renderSettings({
  canManageClinicUsers,
  canManageWhatsapp,
  isLoading = false,
}: {
  canManageClinicUsers: boolean
  canManageWhatsapp: boolean
  isLoading?: boolean
}) {
  return renderToStaticMarkup(
    <SettingsView
      businessHours={businessHours}
      calendarExceptions={calendarExceptions}
      canManageClinicUsers={canManageClinicUsers}
      canManageWhatsapp={canManageWhatsapp}
      clinicUsers={[]}
      clinicMembersCount={0}
      clinicMembersMaxUsers={4}
      isLoading={isLoading}
      onBusinessHoursChange={successfulAction}
      onCreateCalendarException={successfulAction}
      onCreateClinicUser={successfulAction}
      onCreateTreatment={successfulAction}
      onDeleteCalendarException={successfulAction}
      onSetTreatmentActive={successfulAction}
      onUpdateTreatment={successfulAction}
      onWhatsappSettingsChange={successfulAction}
      treatments={treatments}
      whatsappSettings={null}
    />,
  )
}

describe('SettingsView permissions', () => {
  it('does not mount clinic users for reception permissions', () => {
    const markup = renderSettings({
      canManageClinicUsers: false,
      canManageWhatsapp: false,
    })

    expect(markup).not.toContain('Usuarios del consultorio')
  })

  it('does not mount users or WhatsApp for a Basic owner', () => {
    const markup = renderSettings({
      canManageClinicUsers: false,
      canManageWhatsapp: false,
    })

    expect(markup).not.toContain('Usuarios del consultorio')
    expect(markup).not.toContain('WhatsApp del consultorio')
  })

  it('mounts users and WhatsApp for an authorized Pro owner', () => {
    const markup = renderSettings({
      canManageClinicUsers: true,
      canManageWhatsapp: true,
    })

    expect(markup).toContain('Usuarios del consultorio')
    expect(markup).toContain('WhatsApp del consultorio')
  })

  it('does not expose settings data while the clinic configuration is loading', () => {
    const markup = renderSettings({
      canManageClinicUsers: true,
      canManageWhatsapp: true,
      isLoading: true,
    })

    expect(markup).toContain('Preparando configuración...')
    expect(markup).not.toContain('Horarios del consultorio')
    expect(markup).not.toContain('Tratamientos del consultorio')
    expect(markup).not.toContain('WhatsApp del consultorio')
  })
})
