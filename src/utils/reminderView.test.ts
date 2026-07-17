import { describe, expect, it } from 'vitest'
import type { Reminder } from '../types/Reminder'
import {
  filterRemindersByAppointmentStatus,
  filterRemindersBySearch,
} from './reminderView'

const reminder: Reminder = {
  appointmentDate: '2026-07-15',
  appointmentId: 'appointment-1',
  appointmentStatus: 'pending',
  appointmentTime: '10:00',
  id: 'reminder-1',
  message: 'Recordatorio',
  patientId: 'patient-1',
  patientName: 'Ángela Pérez',
  phone: '+59170000000',
  reminderType: '2h',
  scheduledFor: '2026-07-15T08:00:00-04:00',
  status: 'skipped',
  treatment: 'Control preventivo',
}

describe('reminder view filters', () => {
  it('finds reminders by patient, phone or treatment without accents', () => {
    expect(filterRemindersBySearch([reminder], 'angela')).toEqual([reminder])
    expect(filterRemindersBySearch([reminder], '70000000')).toEqual([reminder])
    expect(filterRemindersBySearch([reminder], 'preventivo')).toEqual([
      reminder,
    ])
  })

  it('filters past unresolved appointments independently of reminder status', () => {
    expect(
      filterRemindersByAppointmentStatus(
        [reminder],
        'past_unresolved',
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toEqual([reminder])
    expect(
      filterRemindersByAppointmentStatus(
        [{ ...reminder, appointmentStatus: 'completed' }],
        'past_unresolved',
        new Date('2026-07-17T14:00:00Z'),
      ),
    ).toEqual([])
  })
})
