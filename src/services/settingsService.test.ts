import { describe, expect, it, vi } from 'vitest'

import type {
  BusinessHourRecord,
  CalendarExceptionRecord,
  TreatmentRecord,
} from '../types/database'
import {
  mapBusinessHoursRecordsToSettings,
  mapBusinessHoursSettingsToInserts,
  mapCalendarExceptionInputToInsert,
  mapCalendarExceptionRecordToCalendarException,
  mapTreatmentInputToInsert,
  mapTreatmentRecordToTreatment,
  saveBusinessHoursWithClient,
} from './settingsService'

const treatmentRecord: TreatmentRecord = {
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  duration_minutes: 45,
  id: 'treatment-1',
  is_active: true,
  name: 'Limpieza dental',
  updated_at: '2026-06-16T12:00:00Z',
}

const businessHourRecord: BusinessHourRecord = {
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  end_time: '18:00:00',
  id: 'business-hour-1',
  is_open: true,
  slot_interval_minutes: 30,
  start_time: '08:00:00',
  updated_at: '2026-06-16T12:00:00Z',
  weekday: 1,
}

const calendarExceptionRecord: CalendarExceptionRecord = {
  clinic_id: 'clinic-1',
  created_at: '2026-06-16T12:00:00Z',
  date: '2026-06-22',
  end_time: '13:00:00',
  id: 'exception-1',
  reason: 'maintenance',
  reason_detail: null,
  start_time: '09:00:00',
  type: 'special-hours',
  updated_at: '2026-06-16T12:00:00Z',
}

describe('settingsService mappers', () => {
  it('maps treatment records and inputs', () => {
    expect(mapTreatmentRecordToTreatment(treatmentRecord)).toEqual({
      durationMinutes: 45,
      id: 'treatment-1',
      isActive: true,
      name: 'Limpieza dental',
    })

    expect(
      mapTreatmentInputToInsert('clinic-1', {
        durationMinutes: 30,
        isActive: true,
        name: 'Consulta',
      }),
    ).toEqual({
      clinic_id: 'clinic-1',
      duration_minutes: 30,
      is_active: true,
      name: 'Consulta',
    })
  })

  it('maps business hours records to frontend settings', () => {
    expect(mapBusinessHoursRecordsToSettings([businessHourRecord])).toEqual({
      isConfigured: true,
      settings: expect.objectContaining({
        appointmentInterval: 30,
        weeklySchedule: expect.arrayContaining([
          {
            day: 'monday',
            endTime: '18:00',
            isOpen: true,
            startTime: '08:00',
          },
        ]),
      }),
    })
  })

  it('returns a closed editable fallback when business hours are empty', () => {
    const result = mapBusinessHoursRecordsToSettings([])

    expect(result.isConfigured).toBe(false)
    expect(result.settings.weeklySchedule).toHaveLength(7)
    expect(result.settings.weeklySchedule.every((day) => !day.isOpen)).toBe(true)
  })

  it('maps business hours settings to clinic-scoped inserts', () => {
    expect(
      mapBusinessHoursSettingsToInserts('clinic-1', {
        appointmentInterval: 30,
        weeklySchedule: [
          {
            day: 'monday',
            endTime: '18:00',
            isOpen: true,
            startTime: '08:00',
          },
        ],
      }),
    ).toEqual([
      {
        clinic_id: 'clinic-1',
        end_time: '18:00',
        is_open: true,
        slot_interval_minutes: 30,
        start_time: '08:00',
        weekday: 1,
      },
    ])
  })

  it('saves business hours through the transactional clinic RPC', async () => {
    const weeklySchedule = [
      {
        day: 'monday' as const,
        endTime: '18:00',
        isOpen: true,
        startTime: '08:00',
      },
      {
        day: 'tuesday' as const,
        endTime: '18:00',
        isOpen: true,
        startTime: '08:00',
      },
      {
        day: 'wednesday' as const,
        endTime: '18:00',
        isOpen: true,
        startTime: '08:00',
      },
      {
        day: 'thursday' as const,
        endTime: '18:00',
        isOpen: true,
        startTime: '08:00',
      },
      {
        day: 'friday' as const,
        endTime: '18:00',
        isOpen: true,
        startTime: '08:00',
      },
      {
        day: 'saturday' as const,
        endTime: '18:00',
        isOpen: false,
        startTime: '08:00',
      },
      {
        day: 'sunday' as const,
        endTime: '18:00',
        isOpen: false,
        startTime: '08:00',
      },
    ]
    const records = weeklySchedule.map((schedule, index) => ({
      clinic_id: 'clinic-1',
      created_at: '2026-07-28T12:00:00Z',
      end_time: schedule.isOpen ? schedule.endTime : null,
      id: `hours-${index}`,
      is_open: schedule.isOpen,
      slot_interval_minutes: 30,
      start_time: schedule.isOpen ? schedule.startTime : null,
      updated_at: '2026-07-28T12:00:00Z',
      weekday: index === 6 ? 0 : index + 1,
    }))
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: records, error: null }),
    }

    await expect(
      saveBusinessHoursWithClient(client, 'clinic-1', {
        appointmentInterval: 30,
        weeklySchedule,
      }),
    ).resolves.toMatchObject({
      data: {
        appointmentInterval: 30,
      },
      error: null,
    })
    expect(client.rpc).toHaveBeenCalledWith(
      'save_clinic_business_hours',
      expect.objectContaining({
        target_clinic_id: 'clinic-1',
        target_hours: expect.arrayContaining([
          expect.objectContaining({
            is_open: true,
            slot_interval_minutes: 30,
            weekday: 1,
          }),
        ]),
      }),
    )
    expect(
      client.rpc.mock.calls[0]?.[1].target_hours[0],
    ).not.toHaveProperty('clinic_id')
  })

  it('maps a rejected business-hours RPC to a friendly permission error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'FORBIDDEN' },
      }),
    }

    await expect(
      saveBusinessHoursWithClient(client, 'clinic-1', {
        appointmentInterval: 30,
        weeklySchedule: [],
      }),
    ).resolves.toEqual({
      data: null,
      error: 'No tienes permiso para modificar los horarios del consultorio.',
    })
  })

  it('maps calendar exception records and inputs', () => {
    expect(
      mapCalendarExceptionRecordToCalendarException(calendarExceptionRecord),
    ).toEqual({
      date: '2026-06-22',
      endTime: '13:00',
      id: 'exception-1',
      reason: 'maintenance',
      reasonDetail: undefined,
      startTime: '09:00',
      type: 'special-hours',
    })

    expect(
      mapCalendarExceptionInputToInsert('clinic-1', {
        date: '2026-06-22',
        endTime: '',
        reason: 'holiday',
        reasonDetail: '',
        startTime: '',
        type: 'closed',
      }),
    ).toEqual({
      clinic_id: 'clinic-1',
      date: '2026-06-22',
      end_time: null,
      reason: 'holiday',
      reason_detail: null,
      start_time: null,
      type: 'closed',
    })
  })
})
