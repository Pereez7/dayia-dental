import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Reminder } from '../types/Reminder'
import { ReminderMessagePreview } from './ReminderMessagePreview'

const reminder: Reminder = {
  appointmentDate: '2027-01-15',
  appointmentId: 'appointment-1',
  appointmentStatus: 'confirmed',
  appointmentTime: '10:30',
  id: 'reminder-1',
  message: 'Hola Ana, te recordamos tu cita.',
  patientId: 'patient-1',
  patientName: 'Ana Pérez',
  phone: '+59170000000',
  reminderType: '2h',
  scheduledFor: '2027-01-15T08:30:00-04:00',
  status: 'pending',
  treatment: 'Control dental',
}

describe('ReminderMessagePreview', () => {
  it('shows a clear empty state before selecting a reminder', () => {
    const markup = renderToStaticMarkup(
      <ReminderMessagePreview reminder={undefined} />,
    )

    expect(markup).toContain('Selecciona un recordatorio para ver el mensaje.')
  })

  it('shows the selected reminder context and final message', () => {
    const markup = renderToStaticMarkup(
      <ReminderMessagePreview reminder={reminder} />,
    )

    expect(markup).toContain('Ana Pérez')
    expect(markup).toContain('15 de enero')
    expect(markup).toContain('10:30')
    expect(markup).toContain('2 horas antes')
    expect(markup).toContain('Control dental')
    expect(markup).toContain('Hola Ana, te recordamos tu cita.')
  })

  it('separates an omitted reminder from its pending appointment', () => {
    const markup = renderToStaticMarkup(
      <ReminderMessagePreview
        onResolveAppointment={() => undefined}
        reminder={{
          ...reminder,
          appointmentDate: '2026-07-15',
          appointmentStatus: 'pending',
          status: 'skipped',
          statusNote: 'Omitido porque la cita ya pasó.',
        }}
      />,
    )

    expect(markup).toContain('Recordatorio omitido')
    expect(markup).toContain('Cita pendiente')
    expect(markup).toContain('Omitido porque la cita ya pasó.')
    expect(markup).toContain('Resolver cita')
    expect(markup).toContain(
      'Este recordatorio ya no requiere una acción de envío.',
    )
  })
})
