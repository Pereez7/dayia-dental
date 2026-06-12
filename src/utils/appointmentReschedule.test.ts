import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import {
  type AppointmentRescheduleValues,
  rescheduleAppointment,
  validateAppointmentReschedule,
} from './appointmentReschedule'

const businessHours: BusinessHoursSettings = {
  appointmentInterval: 30,
  weeklySchedule: [
    {
      day: 'friday',
      endTime: '18:00',
      isOpen: true,
      startTime: '08:00',
    },
    {
      day: 'saturday',
      endTime: '12:00',
      isOpen: true,
      startTime: '08:00',
    },
    {
      day: 'sunday',
      endTime: '12:00',
      isOpen: false,
      startTime: '08:00',
    },
  ],
}

const appointment: Appointment = {
  date: '2026-06-12',
  id: 1,
  patient: 'Mariana Rojas',
  patientId: 1,
  status: 'confirmed',
  time: '09:00',
  treatment: 'Limpieza dental',
}

const appointments: Appointment[] = [
  appointment,
  {
    date: '2026-06-12',
    id: 2,
    patient: 'Carlos Medina',
    patientId: 2,
    status: 'pending',
    time: '10:00',
    treatment: 'Evaluación inicial',
  },
  {
    date: '2026-06-13',
    id: 3,
    patient: 'Mariana Rojas',
    patientId: 1,
    status: 'pending',
    time: '09:30',
    treatment: 'Control odontológico',
  },
  {
    date: '2026-06-12',
    id: 4,
    patient: 'Ana Salazar',
    patientId: 3,
    status: 'cancelled',
    time: '11:00',
    treatment: 'Curación dental',
  },
]

function getRescheduleValues(values: {
  date: string
  time: string
}): AppointmentRescheduleValues {
  return {
    ...values,
    reason: 'patient-request',
    reasonDetail: '',
  }
}

function validate(values: { date: string; time: string }) {
  return validateAppointmentReschedule(
    appointment,
    getRescheduleValues(values),
    appointments,
    businessHours,
    new Date('2026-06-08T10:00:00'),
  )
}

describe('rescheduleAppointment', () => {
  it('keeps patient and treatment data', () => {
    const updatedAppointment = rescheduleAppointment(appointment, {
      date: '2026-06-13',
      reason: 'patient-request',
      reasonDetail: '',
      time: '10:30',
    })

    expect(updatedAppointment.patient).toBe('Mariana Rojas')
    expect(updatedAppointment.patientId).toBe(1)
    expect(updatedAppointment.treatment).toBe('Limpieza dental')
  })

  it('changes date, time and status to rescheduled', () => {
    expect(
      rescheduleAppointment(
        appointment,
        {
          date: '2026-06-13',
          reason: 'patient-request',
          reasonDetail: '',
          time: '10:30',
        },
        {
          reason: 'Solicitud del paciente',
        },
      ),
    ).toMatchObject({
      date: '2026-06-13',
      rescheduleReason: 'Solicitud del paciente',
      status: 'rescheduled',
      time: '10:30',
    })
  })
})

describe('validateAppointmentReschedule', () => {
  it('rejects rescheduling without changing date or time', () => {
    expect(validate({ date: '2026-06-12', time: '09:00' }).appointment).toBe(
      'Debes cambiar la fecha o la hora para reprogramar la cita.',
    )
  })

  it('allows rescheduling when only the date changes', () => {
    expect(validate({ date: '2026-06-19', time: '09:00' })).toEqual({})
  })

  it('allows rescheduling when only the time changes', () => {
    expect(validate({ date: '2026-06-12', time: '09:30' })).toEqual({})
  })

  it('allows rescheduling when date and time change', () => {
    expect(validate({ date: '2026-06-19', time: '08:30' })).toEqual({})
  })

  it('ignores the current appointment when validating patient appointment on date', () => {
    expect(validate({ date: '2026-06-12', time: '09:30' }).patient).toBeUndefined()
  })

  it('rejects a closed day', () => {
    expect(validate({ date: '2026-06-14', time: '09:00' }).date).toBe(
      'El consultorio está cerrado ese día.',
    )
  })

  it('rejects an occupied time', () => {
    expect(validate({ date: '2026-06-12', time: '10:00' }).time).toBe(
      'Ya existe una cita programada para esa fecha y hora.',
    )
  })

  it('rejects another active appointment for the same patient that day', () => {
    expect(validate({ date: '2026-06-13', time: '10:00' }).patient).toBe(
      'Este paciente ya tiene otra cita activa ese día.',
    )
  })

  it('allows a time occupied by a cancelled appointment', () => {
    expect(validate({ date: '2026-06-12', time: '11:00' })).toEqual({})
  })

  it('rejects a past time for today', () => {
    const errors = validateAppointmentReschedule(
      appointment,
      getRescheduleValues({ date: '2026-06-12', time: '09:00' }),
      appointments,
      businessHours,
      new Date('2026-06-12T09:30:00'),
    )

    expect(errors.time).toBe('No puedes seleccionar una hora que ya pasó.')
  })

  it('rejects rescheduling a cancelled appointment', () => {
    const errors = validateAppointmentReschedule(
      { ...appointment, status: 'cancelled' },
      getRescheduleValues({ date: '2026-06-12', time: '09:00' }),
      appointments,
      businessHours,
      new Date('2026-06-08T10:00:00'),
    )

    expect(errors.appointment).toBe(
      'No puedes reprogramar una cita cancelada.',
    )
  })
})
