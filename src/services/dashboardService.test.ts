import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
  },
}))

import {
  getDashboardSnapshot,
  parseDashboardSnapshot,
} from './dashboardService'

const payload = {
  attentionAppointments: [
    {
      changeLog: [],
      date: '2026-08-04',
      durationMinutes: 30,
      id: 'appointment-pending',
      patient: 'Ana Paz',
      patientId: 'patient-1',
      status: 'pending',
      time: '11:00',
      treatment: 'Control',
    },
  ],
  recentActivityAppointments: [
    {
      changeLog: [
        {
          createdAt: '2026-08-04T14:00:00.000Z',
          description: 'Cita confirmada.',
          id: 'log-1',
          metadata: {},
          type: 'confirmed',
        },
      ],
      date: '2026-08-04',
      durationMinutes: 30,
      id: 'appointment-confirmed',
      patient: 'Luis Soliz',
      patientId: 'patient-2',
      status: 'confirmed',
      time: '12:00',
      treatment: 'Limpieza',
    },
  ],
  recentPatients: [
    {
      fullName: 'Paciente Reciente',
      id: 'patient-3',
      lastVisit: 'Sin registro',
      nextAppointment: null,
      phone: '+59170000000',
      status: 'active',
    },
  ],
  summary: {
    monthlyCancelledAppointments: 2,
    monthlyRescheduledAppointments: 3,
    registeredPatients: 40,
    todayAppointments: 5,
    todayConfirmedAppointments: 2,
    todayPendingAppointments: 1,
  },
  upcomingAppointments: [
    {
      date: '2026-08-04',
      durationMinutes: 30,
      id: 'appointment-upcoming',
      patient: 'Mario Rojas',
      patientId: 'patient-4',
      status: 'confirmed',
      time: '15:00',
      treatment: 'Evaluación',
    },
  ],
}

describe('dashboardService', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset()
  })

  it('requests one bounded snapshot with the clinic and local reference time', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: payload, error: null })

    const result = await getDashboardSnapshot(
      'clinic-active',
      new Date(2026, 7, 4, 10, 30, 15),
    )

    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'get_clinic_dashboard_snapshot',
      {
        target_clinic_id: 'clinic-active',
        target_reference_date: '2026-08-04',
        target_reference_time: '10:30:15',
      },
    )
    expect(result.error).toBeNull()
    expect(result.data?.summary.registeredPatients).toBe(40)
    expect(result.data?.upcomingAppointments).toHaveLength(1)
    expect(result.data?.attentionItems[0]?.id).toBe(
      'pending-appointment-pending',
    )
    expect(result.data?.recentActivity[0]?.description).toBe(
      'Cita confirmada',
    )
  })

  it('rejects an incomplete RPC payload instead of showing misleading totals', () => {
    expect(
      parseDashboardSnapshot(
        { ...payload, summary: { todayAppointments: 5 } },
        new Date(2026, 7, 4, 10, 30),
      ),
    ).toBeNull()
  })

  it('maps authorization errors to a visible non-technical message', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501' },
    })

    await expect(
      getDashboardSnapshot('clinic-forbidden', new Date(2026, 7, 4, 10)),
    ).resolves.toEqual({
      data: null,
      error: 'No tienes permiso para consultar este Dashboard.',
    })
  })
})
