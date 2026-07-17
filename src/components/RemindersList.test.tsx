import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ReminderDateGroup } from '../types/Reminder'
import { RemindersList } from './RemindersList'

const skippedDateGroups: ReminderDateGroup[] = [
  {
    appointmentDate: '2026-07-15',
    appointmentGroups: [
      {
        appointmentDate: '2026-07-15',
        appointmentId: 'appointment-1',
        appointmentStatus: 'confirmed',
        appointmentTime: '10:00',
        omittedReminderNotes: [],
        patientId: 'patient-1',
        patientName: 'Ana Pérez',
        phone: '+59170000000',
        reminders: [
          {
            appointmentDate: '2026-07-15',
            appointmentId: 'appointment-1',
            appointmentStatus: 'confirmed',
            appointmentTime: '10:00',
            id: 'reminder-1',
            message: 'Recordatorio',
            patientId: 'patient-1',
            patientName: 'Ana Pérez',
            phone: '+59170000000',
            reminderType: '2h',
            scheduledFor: '2026-07-15T12:00:00Z',
            status: 'skipped',
            statusNote: 'Omitido porque la cita ya pasó.',
            treatment: 'Control',
          },
        ],
        treatment: 'Control',
      },
    ],
    label: 'Miércoles, 15 de julio',
  },
]

describe('RemindersList omitted state', () => {
  it('shows the omitted reason without manual-send actions', () => {
    const markup = renderToStaticMarkup(
      <RemindersList
        dateGroups={skippedDateGroups}
        emptyDescription=""
        emptyMessage=""
        selectedReminderId={null}
        onMarkFailed={vi.fn()}
        onMarkSent={vi.fn()}
        onSelectReminder={vi.fn()}
      />,
    )

    expect(markup).toContain('Omitido porque la cita ya pasó.')
    expect(markup).toContain('Omitido')
    expect(markup).not.toContain('Abrir WhatsApp')
    expect(markup).not.toContain('Marcar enviado')
    expect(markup).not.toContain('Marcar fallido')
  })
})
