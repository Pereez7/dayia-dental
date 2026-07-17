import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { businessHours } from '../data/businessHours'
import { treatments } from '../data/treatments'
import type { Appointment } from '../types/Appointment'
import { ResolvePastAppointmentDialog } from './ResolvePastAppointmentDialog'

const appointment: Appointment = {
  date: '2026-07-15',
  id: 'appointment-1',
  patient: 'Ana Pérez',
  patientId: 'patient-1',
  status: 'pending',
  time: '10:00',
  treatment: 'Control',
}

describe('ResolvePastAppointmentDialog', () => {
  it('shows every supported resolution for a past appointment', () => {
    const markup = renderToStaticMarkup(
      <ResolvePastAppointmentDialog
        appointment={appointment}
        appointments={[appointment]}
        businessHours={businessHours}
        calendarExceptions={[]}
        isOpen
        onCancel={vi.fn()}
        onResolved={vi.fn()}
        onReschedule={vi.fn()}
        onUpdateStatus={vi.fn()}
        treatments={treatments}
      />,
    )

    expect(markup).toContain('Resolver cita pasada')
    expect(markup).toContain('Marcar atendida')
    expect(markup).toContain('Marcar no asistió')
    expect(markup).toContain('Reprogramar')
    expect(markup).toContain('Cancelar cita')
    expect(markup).toContain('Elige cómo cerrar esta cita vencida.')
    expect(markup).toContain('Ana Pérez')
    expect(markup).toContain('15 jul')
    expect(markup).toContain('10:00')
    expect(markup).not.toContain('2026-07-15')
  })
})
