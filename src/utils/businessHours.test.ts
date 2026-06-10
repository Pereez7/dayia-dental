import { describe, expect, it } from 'vitest'
import type { BusinessHoursSettings } from '../types/BusinessHours'
import {
  areBusinessHoursSettingsEqual,
  generateBusinessTimeSlotsForDate,
  getBusinessDayScheduleForDate,
  getWeekdayFromDate,
  hasBusinessHoursErrors,
  isEndTimeAfterStartTime,
  isTimeInsideBusinessHours,
  isValidBusinessTimeFormat,
  validateAppointmentAgainstBusinessHours,
  validateBusinessDaySchedule,
  validateBusinessHours,
} from './businessHours'

const validSettings: BusinessHoursSettings = {
  appointmentInterval: 30,
  weeklySchedule: [
    {
      day: 'monday',
      endTime: '18:00',
      isOpen: true,
      startTime: '08:00',
    },
    {
      day: 'sunday',
      endTime: '',
      isOpen: false,
      startTime: '',
    },
  ],
}

describe('isEndTimeAfterStartTime', () => {
  it('returns true when end time is later than start time', () => {
    expect(isEndTimeAfterStartTime('08:00', '18:00')).toBe(true)
  })

  it('returns false when end time is equal or earlier than start time', () => {
    expect(isEndTimeAfterStartTime('18:00', '18:00')).toBe(false)
    expect(isEndTimeAfterStartTime('18:00', '08:00')).toBe(false)
  })
})

describe('isValidBusinessTimeFormat', () => {
  it('returns true for 24-hour HH:mm values', () => {
    expect(isValidBusinessTimeFormat('08:00')).toBe(true)
    expect(isValidBusinessTimeFormat('12:30')).toBe(true)
    expect(isValidBusinessTimeFormat('23:59')).toBe(true)
  })

  it('returns false for incomplete or 12-hour style values', () => {
    expect(isValidBusinessTimeFormat('8:00')).toBe(false)
    expect(isValidBusinessTimeFormat('08:00 a.m.')).toBe(false)
    expect(isValidBusinessTimeFormat('24:00')).toBe(false)
    expect(isValidBusinessTimeFormat('18:75')).toBe(false)
  })
})

describe('validateBusinessDaySchedule', () => {
  it('requires start and end time when the day is open', () => {
    expect(
      validateBusinessDaySchedule({
        day: 'monday',
        endTime: '',
        isOpen: true,
        startTime: '',
      }),
    ).toBe('Define una hora de inicio y fin para este día.')
  })

  it('requires end time to be greater than start time', () => {
    expect(
      validateBusinessDaySchedule({
        day: 'monday',
        endTime: '08:00',
        isOpen: true,
        startTime: '18:00',
      }),
    ).toBe('La hora de fin debe ser mayor que la hora de inicio.')
  })

  it('requires a valid 24-hour time format', () => {
    expect(
      validateBusinessDaySchedule({
        day: 'monday',
        endTime: '6:00 p.m.',
        isOpen: true,
        startTime: '08:00',
      }),
    ).toBe('Usa formato de 24 horas HH:mm, por ejemplo 08:00.')
  })

  it('ignores times when the day is closed', () => {
    expect(
      validateBusinessDaySchedule({
        day: 'sunday',
        endTime: '',
        isOpen: false,
        startTime: '',
      }),
    ).toBe('')
  })
})

describe('validateBusinessHours', () => {
  it('returns no errors for a valid weekly schedule', () => {
    const errors = validateBusinessHours(validSettings)

    expect(errors).toEqual({})
    expect(hasBusinessHoursErrors(errors)).toBe(false)
  })

  it('returns errors indexed by weekday', () => {
    const errors = validateBusinessHours({
      ...validSettings,
      weeklySchedule: [
        {
          day: 'monday',
          endTime: '08:00',
          isOpen: true,
          startTime: '18:00',
        },
      ],
    })

    expect(errors).toEqual({
      monday: 'La hora de fin debe ser mayor que la hora de inicio.',
    })
    expect(hasBusinessHoursErrors(errors)).toBe(true)
  })
})

describe('areBusinessHoursSettingsEqual', () => {
  it('returns true when settings have the same interval and schedule', () => {
    expect(
      areBusinessHoursSettingsEqual(validSettings, {
        ...validSettings,
        weeklySchedule: [...validSettings.weeklySchedule],
      }),
    ).toBe(true)
  })

  it('returns false when interval or schedule changed', () => {
    expect(
      areBusinessHoursSettingsEqual(validSettings, {
        ...validSettings,
        appointmentInterval: 15,
      }),
    ).toBe(false)

    expect(
      areBusinessHoursSettingsEqual(validSettings, {
        ...validSettings,
        weeklySchedule: [
          {
            ...validSettings.weeklySchedule[0],
            endTime: '19:00',
          },
          validSettings.weeklySchedule[1],
        ],
      }),
    ).toBe(false)
  })
})

describe('business hours by appointment date', () => {
  const weeklySettings: BusinessHoursSettings = {
    appointmentInterval: 30,
    weeklySchedule: [
      {
        day: 'monday',
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

  it('gets the configured weekday schedule from a date', () => {
    expect(getWeekdayFromDate('2026-06-08')).toBe('monday')
    expect(
      getBusinessDayScheduleForDate(weeklySettings, '2026-06-13')?.day,
    ).toBe('saturday')
  })

  it('allows a time inside an open day schedule', () => {
    const mondaySchedule = getBusinessDayScheduleForDate(
      weeklySettings,
      '2026-06-08',
    )

    expect(mondaySchedule).toBeDefined()
    expect(isTimeInsideBusinessHours(mondaySchedule!, '09:30')).toBe(true)
  })

  it('rejects appointments on closed days', () => {
    expect(
      validateAppointmentAgainstBusinessHours(
        weeklySettings,
        '2026-06-14',
        '09:00',
      ),
    ).toBe('El consultorio está cerrado ese día.')
  })

  it('rejects time before opening or after closing', () => {
    expect(
      validateAppointmentAgainstBusinessHours(
        weeklySettings,
        '2026-06-08',
        '07:30',
      ),
    ).toBe('La hora seleccionada está fuera del horario de atención.')
    expect(
      validateAppointmentAgainstBusinessHours(
        weeklySettings,
        '2026-06-08',
        '18:30',
      ),
    ).toBe('La hora seleccionada está fuera del horario de atención.')
  })

  it('generates appointment slots using a 30 minute interval', () => {
    expect(generateBusinessTimeSlotsForDate(weeklySettings, '2026-06-13')).toEqual(
      [
        { label: '08:00', value: '08:00' },
        { label: '08:30', value: '08:30' },
        { label: '09:00', value: '09:00' },
        { label: '09:30', value: '09:30' },
        { label: '10:00', value: '10:00' },
        { label: '10:30', value: '10:30' },
        { label: '11:00', value: '11:00' },
        { label: '11:30', value: '11:30' },
      ],
    )
  })

  it('generates appointment slots using a 60 minute interval', () => {
    expect(
      generateBusinessTimeSlotsForDate(
        {
          ...weeklySettings,
          appointmentInterval: 60,
        },
        '2026-06-13',
      ),
    ).toEqual([
      { label: '08:00', value: '08:00' },
      { label: '09:00', value: '09:00' },
      { label: '10:00', value: '10:00' },
      { label: '11:00', value: '11:00' },
    ])
  })

  it('does not generate slots for closed days', () => {
    expect(generateBusinessTimeSlotsForDate(weeklySettings, '2026-06-14')).toEqual(
      [],
    )
  })
})
