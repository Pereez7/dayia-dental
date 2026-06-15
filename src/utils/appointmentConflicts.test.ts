import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types/Appointment'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import {
  doTimeRangesOverlap,
  getAvailableTimeOptions,
  getAvailableTimeOptionsByDuration,
  getAppointmentTimeRange,
  hasAppointmentDurationConflict,
  hasAppointmentConflict,
  hasPatientAppointmentOnDate,
} from './appointmentConflicts'

const appointments: Appointment[] = [
  {
    date: '2026-06-10',
    id: 1,
    patient: 'Jorge Quiroga',
    patientId: 1,
    status: 'pending',
    time: '09:00',
    treatment: 'Limpieza dental',
  },
  {
    date: '2026-06-10',
    id: 2,
    patient: 'Ana Salazar',
    patientId: 2,
    status: 'confirmed',
    time: '10:00',
    treatment: 'Evaluación inicial',
  },
  {
    date: '2026-06-11',
    id: 3,
    patient: 'Carlos Medina',
    patientId: 3,
    status: 'rescheduled',
    time: '09:00',
    treatment: 'Control odontológico',
  },
  {
    date: '2026-06-10',
    id: 4,
    patient: 'Mariana Rojas',
    patientId: 4,
    status: 'cancelled',
    time: '11:00',
    treatment: 'Curación dental',
  },
]

const businessHours: BusinessHoursSettings = {
  appointmentInterval: 30,
  weeklySchedule: [
    {
      day: 'wednesday',
      endTime: '11:00',
      isOpen: true,
      startTime: '09:00',
    },
    {
      day: 'thursday',
      endTime: '11:00',
      isOpen: false,
      startTime: '09:00',
    },
  ],
}

describe('hasAppointmentConflict', () => {
  it('returns conflict when an active appointment has the same date and time', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00')).toBe(
      true,
    )
  })

  it('does not return conflict when the time is different', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:30')).toBe(
      false,
    )
  })

  it('does not return conflict when the date is different', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-12', '09:00')).toBe(
      false,
    )
  })

  it('does not return conflict when the existing appointment is cancelled', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '11:00')).toBe(
      false,
    )
  })

  it('returns conflict for pending, confirmed and rescheduled appointments', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00')).toBe(
      true,
    )
    expect(hasAppointmentConflict(appointments, '2026-06-10', '10:00')).toBe(
      true,
    )
    expect(hasAppointmentConflict(appointments, '2026-06-11', '09:00')).toBe(
      true,
    )
  })

  it('ignores the appointment id when requested', () => {
    expect(hasAppointmentConflict(appointments, '2026-06-10', '09:00', 1)).toBe(
      false,
    )
  })
})

describe('appointment duration conflicts', () => {
  const durationAppointments: Appointment[] = [
    {
      date: '2026-06-10',
      durationMinutes: 30,
      id: 1,
      patient: 'Jorge Quiroga',
      patientId: 1,
      status: 'pending',
      time: '13:00',
      treatment: 'Consulta de emergencia',
    },
    {
      date: '2026-06-10',
      durationMinutes: 30,
      id: 2,
      patient: 'Ana Salazar',
      patientId: 2,
      status: 'cancelled',
      time: '14:00',
      treatment: 'Control odontológico',
    },
  ]

  it('detects overlap when a new appointment starts inside another', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '13:15',
        30,
      ),
    ).toBe(true)
  })

  it('detects overlap when a new appointment ends inside another', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '12:45',
        30,
      ),
    ).toBe(true)
  })

  it('detects overlap when a new appointment covers another appointment', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '12:45',
        60,
      ),
    ).toBe(true)
  })

  it('detects overlap when a new appointment is fully inside another', () => {
    expect(
      hasAppointmentDurationConflict(
        [
          {
            ...durationAppointments[0],
            durationMinutes: 60,
          },
        ],
        '2026-06-10',
        '13:15',
        15,
      ),
    ).toBe(true)
  })

  it('does not detect overlap when a new appointment ends exactly when another starts', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '12:30',
        30,
      ),
    ).toBe(false)
  })

  it('does not detect overlap when a new appointment starts exactly when another ends', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '13:30',
        30,
      ),
    ).toBe(false)
  })

  it('ignores cancelled appointments', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '14:15',
        30,
      ),
    ).toBe(false)
  })

  it('ignores the current appointment when rescheduling', () => {
    expect(
      hasAppointmentDurationConflict(
        durationAppointments,
        '2026-06-10',
        '13:15',
        30,
        1,
      ),
    ).toBe(false)
  })

  it('uses a 30 minute fallback for older appointments without duration', () => {
    expect(
      hasAppointmentDurationConflict(
        [
          {
            date: '2026-06-10',
            id: 5,
            patient: 'Paciente antiguo',
            patientId: 5,
            status: 'confirmed',
            time: '15:00',
            treatment: 'Tratamiento antiguo',
          },
        ],
        '2026-06-10',
        '15:15',
        30,
      ),
    ).toBe(true)
  })

  it('builds comparable appointment time ranges', () => {
    expect(getAppointmentTimeRange('2026-06-10', '13:00', 30)).toEqual({
      date: '2026-06-10',
      endMinutes: 810,
      endTime: '13:30',
      startMinutes: 780,
      startTime: '13:00',
    })
  })

  it('compares time ranges with exclusive edges', () => {
    const firstRange = getAppointmentTimeRange('2026-06-10', '13:00', 30)
    const secondRange = getAppointmentTimeRange('2026-06-10', '13:30', 30)

    expect(firstRange && secondRange).toBeTruthy()
    expect(doTimeRangesOverlap(firstRange!, secondRange!)).toBe(false)
  })
})

describe('hasPatientAppointmentOnDate', () => {
  it('returns true when the patient has an active appointment that day', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-10')).toBe(
      true,
    )
  })

  it('returns false when the appointment is another day', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-11')).toBe(
      false,
    )
  })

  it('returns false when the appointment is cancelled', () => {
    expect(hasPatientAppointmentOnDate(appointments, 4, '2026-06-10')).toBe(
      false,
    )
  })

  it('returns false when the appointment belongs to another patient', () => {
    expect(hasPatientAppointmentOnDate(appointments, 5, '2026-06-10')).toBe(
      false,
    )
  })

  it('ignores the appointment id when requested', () => {
    expect(hasPatientAppointmentOnDate(appointments, 1, '2026-06-10', 1)).toBe(
      false,
    )
  })
})

describe('getAvailableTimeOptions', () => {
  it('does not show occupied times', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).not.toContain('09:00')
  })

  it('shows free times', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toContain('09:30')
  })

  it('ignores cancelled appointments', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toContain('10:30')
  })

  it('respects business hours', () => {
    expect(
      getAvailableTimeOptions(businessHours, appointments, '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toEqual(['09:30', '10:30'])
  })

  it('respects the configured interval', () => {
    expect(
      getAvailableTimeOptions(businessHours, [], '2026-06-10').map(
        (slot) => slot.value,
      ),
    ).toEqual(['09:00', '09:30', '10:00', '10:30'])
  })

  it('returns an empty list when the clinic is closed', () => {
    expect(getAvailableTimeOptions(businessHours, [], '2026-06-11')).toEqual([])
  })

  it('does not show past times when the selected date is today', () => {
    const options = getAvailableTimeOptions(businessHours, [], '2026-06-10', {
      excludePastTimes: true,
      referenceDate: new Date('2026-06-10T09:30:00'),
    }).map((slot) => slot.value)

    expect(options).not.toContain('09:00')
    expect(options).not.toContain('09:30')
    expect(options).toContain('10:30')
  })

  it('keeps future dates unchanged when excluding past times', () => {
    expect(
      getAvailableTimeOptions(businessHours, [], '2026-06-10', {
        excludePastTimes: true,
        referenceDate: new Date('2026-06-09T15:30:00'),
      }).map((slot) => slot.value),
    ).toEqual(['09:00', '09:30', '10:00', '10:30'])
  })

  it('keeps the next 15 minute option after the current time', () => {
    const fifteenMinuteBusinessHours: BusinessHoursSettings = {
      ...businessHours,
      appointmentInterval: 15,
    }

    expect(
      getAvailableTimeOptions(
        fifteenMinuteBusinessHours,
        [],
        '2026-06-10',
        {
          excludePastTimes: true,
          referenceDate: new Date('2026-06-10T09:30:00'),
        },
      ).map((slot) => slot.value),
    ).toContain('09:45')
  })
})

describe('getAvailableTimeOptionsByDuration', () => {
  const durationBusinessHours: BusinessHoursSettings = {
    appointmentInterval: 15,
    weeklySchedule: [
      {
        day: 'wednesday',
        endTime: '14:00',
        isOpen: true,
        startTime: '13:00',
      },
    ],
  }

  const durationAppointments: Appointment[] = [
    {
      date: '2026-06-10',
      durationMinutes: 30,
      id: 1,
      patient: 'Ana Salazar',
      patientId: 1,
      status: 'confirmed',
      time: '13:00',
      treatment: 'Consulta de emergencia',
    },
  ]

  it('does not show times that overlap active appointments', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        durationAppointments,
        '2026-06-10',
        30,
      ).map((slot) => slot.value),
    ).toEqual(['13:30'])
  })

  it('does not show times that exceed closing time', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        [],
        '2026-06-10',
        45,
      ).map((slot) => slot.value),
    ).toEqual(['13:00', '13:15'])
  })

  it('respects the selected treatment duration', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        durationAppointments,
        '2026-06-10',
        60,
      ).map((slot) => slot.value),
    ).toEqual([])
  })

  it('keeps past times hidden for today', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        [],
        '2026-06-10',
        30,
        {
          excludePastTimes: true,
          referenceDate: new Date('2026-06-10T13:15:00'),
        },
      ).map((slot) => slot.value),
    ).toEqual(['13:30'])
  })

  it('generates available times from special hours exceptions', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        [],
        '2026-06-14',
        30,
        {
          calendarExceptions: [
            {
              date: '2026-06-14',
              endTime: '10:00',
              id: 1,
              startTime: '09:00',
              type: 'special-hours',
            },
          ],
        },
      ).map((slot) => slot.value),
    ).toEqual(['09:00', '09:15', '09:30'])
  })

  it('does not show times that exceed special hours', () => {
    expect(
      getAvailableTimeOptionsByDuration(
        durationBusinessHours,
        [],
        '2026-06-14',
        45,
        {
          calendarExceptions: [
            {
              date: '2026-06-14',
              endTime: '10:00',
              id: 1,
              startTime: '09:00',
              type: 'special-hours',
            },
          ],
        },
      ).map((slot) => slot.value),
    ).toEqual(['09:00', '09:15'])
  })
})
