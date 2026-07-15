import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}))

import { getAppointmentsByClinic } from './appointmentsService'
import { getPatientsByClinic } from './patientsService'

function createSuccessfulQuery(orderCount: 1 | 2) {
  const query = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  }

  query.eq.mockReturnValue(query)
  query.select.mockReturnValue(query)

  if (orderCount === 2) {
    query.order
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce({ data: [], error: null })
  } else {
    query.order.mockResolvedValueOnce({ data: [], error: null })
  }

  return query
}

describe('dashboard data scope', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
  })

  it('scopes patients, appointments and activity logs to the active clinic', async () => {
    const patientsQuery = createSuccessfulQuery(2)
    const appointmentsQuery = createSuccessfulQuery(2)
    const logsQuery = createSuccessfulQuery(1)

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'patients') return patientsQuery
      if (table === 'appointments') return appointmentsQuery
      return logsQuery
    })

    await getPatientsByClinic('clinic-active')
    await getAppointmentsByClinic('clinic-active')

    expect(patientsQuery.eq).toHaveBeenCalledWith('clinic_id', 'clinic-active')
    expect(appointmentsQuery.eq).toHaveBeenCalledWith(
      'clinic_id',
      'clinic-active',
    )
    expect(logsQuery.eq).toHaveBeenCalledWith('clinic_id', 'clinic-active')
  })
})
