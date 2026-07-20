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
        appointmentStatus: 'pending',
        appointmentTime: '10:00',
        omittedReminderNotes: [],
        patientId: 'patient-1',
        patientName: 'Ana Pérez',
        phone: '+59170000000',
        reminders: [
          {
            appointmentDate: '2026-07-15',
            appointmentId: 'appointment-1',
            appointmentStatus: 'pending',
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
        onResolveAppointment={vi.fn()}
        onSelectReminder={vi.fn()}
      />,
    )

    expect(markup).toContain('Omitido porque la cita ya pasó.')
    expect(markup).toContain('Recordatorio omitido')
    expect(markup).toContain('Cita: Pendiente')
    expect(markup).toContain('Cita pasada sin cierre.')
    expect(markup).toContain('Resolver cita')
    expect(markup).not.toContain('appointment-status')
    expect(markup).not.toContain('Abrir WhatsApp')
    expect(markup).not.toContain('Marcar enviado')
    expect(markup).not.toContain('Marcar fallido')
  })

  it('prioritizes the manual WhatsApp action for active reminders', () => {
    const pendingGroups: ReminderDateGroup[] = [
      {
        ...skippedDateGroups[0],
        appointmentDate: '2027-01-15',
        appointmentGroups: [
          {
            ...skippedDateGroups[0].appointmentGroups[0],
            appointmentDate: '2027-01-15',
            appointmentStatus: 'confirmed',
            reminders: [
              {
                ...skippedDateGroups[0].appointmentGroups[0].reminders[0],
                appointmentDate: '2027-01-15',
                appointmentStatus: 'confirmed',
                message: 'Hola Ana',
                scheduledFor: '2027-01-15T08:00:00-04:00',
                status: 'pending',
                statusNote: undefined,
              },
            ],
          },
        ],
      },
    ]
    const markup = renderToStaticMarkup(
      <RemindersList
        dateGroups={pendingGroups}
        emptyDescription=""
        emptyMessage=""
        selectedReminderId={null}
        onMarkFailed={vi.fn()}
        onMarkSent={vi.fn()}
        onSelectReminder={vi.fn()}
      />,
    )

    expect(markup).toContain(
      'href="https://wa.me/59170000000?text=Hola%20Ana"',
    )
    expect(markup).toContain('Abrir WhatsApp')
    expect(markup).toContain('Marcar enviado')
    expect(markup).toContain('Marcar fallido')
  })

  it('shows close appointments as manual actions without a scheduled time', () => {
    const manualGroups: ReminderDateGroup[] = [
      {
        ...skippedDateGroups[0],
        appointmentDate: '2027-01-15',
        appointmentGroups: [
          {
            ...skippedDateGroups[0].appointmentGroups[0],
            appointmentDate: '2027-01-15',
            reminders: [
              {
                ...skippedDateGroups[0].appointmentGroups[0].reminders[0],
                appointmentDate: '2027-01-15',
                reminderType: 'immediate',
                scheduledFor: '2027-01-15T16:30:00-04:00',
                status: 'pending',
              },
            ],
          },
        ],
      },
    ]
    const markup = renderToStaticMarkup(
      <RemindersList
        dateGroups={manualGroups}
        emptyDescription=""
        emptyMessage=""
        selectedReminderId={null}
        onMarkFailed={vi.fn()}
        onMarkSent={vi.fn()}
        onSelectReminder={vi.fn()}
      />,
    )

    expect(markup).toContain('Acción manual (cita cercana)')
    expect(markup).toContain('Envío manual, sin programación')
    expect(markup).toContain('Acción manual pendiente')
    expect(markup).not.toContain('Programado para')
    expect(markup).not.toContain('15 ene, 16:30')
  })
})
