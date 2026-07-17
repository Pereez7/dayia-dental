import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { businessHours } from '../data/businessHours'
import { treatments } from '../data/treatments'
import type { Reminder, ReminderStatus } from '../types/Reminder'
import { getReminderEmptyStateCopy } from '../utils/reminderView'
import { WhatsAppRemindersView } from './WhatsAppRemindersView'

function createReminder(id: string, status: ReminderStatus): Reminder {
  return {
    appointmentDate: '2027-01-15',
    appointmentId: `appointment-${id}`,
    appointmentStatus: status === 'cancelled' ? 'cancelled' : 'confirmed',
    appointmentTime: '10:30',
    id,
    message: `Mensaje ${id}`,
    patientId: `patient-${id}`,
    patientName: `Paciente ${id}`,
    phone: '+59170000000',
    reminderType: '2h',
    scheduledFor: '2027-01-15T08:30:00-04:00',
    status,
    treatment: 'Control dental',
  }
}

describe('WhatsAppRemindersView', () => {
  it('communicates the pending Pro automation and renders every KPI', () => {
    const reminders = [
      createReminder('pending', 'pending'),
      createReminder('skipped', 'skipped'),
      createReminder('cancelled', 'cancelled'),
    ]
    const markup = renderToStaticMarkup(
      <WhatsAppRemindersView
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        patients={[]}
        planId="pro"
        reminders={reminders}
        treatments={treatments}
      />,
    )

    expect(markup).toContain('Automático pendiente de configuración')
    expect(markup).toContain('El envío automático por WhatsApp API todavía no está activo.')
    expect(markup).toContain('Pendientes')
    expect(markup).toContain('Omitidos')
    expect(markup).toContain('Cancelados')
    expect(markup).toContain('Selecciona un recordatorio para ver el mensaje.')
  })

  it('uses manual mode outside Pro', () => {
    const markup = renderToStaticMarkup(
      <WhatsAppRemindersView
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        patients={[]}
        planId="medium"
        reminders={[]}
        treatments={treatments}
      />,
    )

    expect(markup).toContain('Modo manual')
    expect(markup).not.toContain('Automático pendiente de configuración')
  })

  it('provides a professional empty state for an omitted filter', () => {
    expect(getReminderEmptyStateCopy(true, 'skipped')).toEqual({
      description: 'El filtro y la fecha seleccionada se mantienen activos.',
      message: 'No hay recordatorios omitidos para esta fecha.',
    })
  })
})
