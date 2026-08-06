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
    expect(markup).toContain('Actualmente el envío es manual desde WhatsApp.')
    expect(markup).toContain(
      'El envío automático está preparado para una etapa posterior.',
    )
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

  it('uses server summaries and exposes bounded pagination', () => {
    const markup = renderToStaticMarkup(
      <WhatsAppRemindersView
        appointments={[]}
        businessHours={businessHours}
        calendarExceptions={[]}
        hasMore
        isServerPaginated
        onLoadMore={() => undefined}
        patients={[]}
        reminders={[createReminder('visible', 'scheduled')]}
        serverDateOptions={[
          {
            appointmentDate: '2027-01-15',
            dateLabel: '15 ene',
            fullLabel: 'Viernes, 15 enero',
            weekdayLabel: 'vie',
          },
        ]}
        serverSelectedDate="2027-01-15"
        serverSelectedDateSummary={{
          cancelled: 0,
          failed: 0,
          pending: 1,
          scheduled: 3,
          sent: 2,
          skipped: 0,
          total: 6,
        }}
        serverSummary={{
          cancelled: 1,
          failed: 1,
          pending: 4,
          scheduled: 5,
          sent: 7,
          skipped: 2,
          total: 20,
        }}
        treatments={treatments}
      />,
    )

    expect(markup).toContain('>20</strong>')
    expect(markup).toContain('Todos (6)')
    expect(markup).toContain('Programado (3)')
    expect(markup).toContain('Cargar más')
  })
})
