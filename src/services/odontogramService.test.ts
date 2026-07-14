import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const order = vi.fn()
  const patientEq = vi.fn(() => ({ order }))
  const clinicEq = vi.fn(() => ({ eq: patientEq }))
  const listSelect = vi.fn(() => ({ eq: clinicEq }))
  const single = vi.fn()
  const saveSelect = vi.fn(() => ({ single }))
  const upsert = vi.fn(() => ({ select: saveSelect }))
  const from = vi.fn(() => ({ select: listSelect, upsert }))

  return {
    clinicEq,
    from,
    listSelect,
    order,
    patientEq,
    saveSelect,
    single,
    upsert,
  }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from },
}))

import {
  getOdontogramErrorMessage,
  listOdontogramEntries,
  mapOdontogramRecord,
  mapSaveOdontogramInputToRecord,
  saveOdontogramEntry,
} from './odontogramService'

const databaseEntry = {
  clinic_id: 'clinic-1',
  created_at: '2026-07-14T12:00:00.000Z',
  created_by: 'doctor-1',
  id: 'entry-1',
  notes: 'Controlar lesión con ñ',
  patient_id: 'patient-1',
  status: 'caries',
  surface: null,
  tooth_code: '16',
  updated_at: '2026-07-14T13:00:00.000Z',
  updated_by: 'doctor-1',
}

describe('odontogram service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.order.mockResolvedValue({ data: [], error: null })
    queryMocks.single.mockResolvedValue({ data: databaseEntry, error: null })
  })

  it('scopes every read by clinic and patient', async () => {
    await listOdontogramEntries('clinic-1', 'patient-1')

    expect(queryMocks.from).toHaveBeenCalledWith('odontogram_entries')
    expect(queryMocks.clinicEq).toHaveBeenCalledWith('clinic_id', 'clinic-1')
    expect(queryMocks.patientEq).toHaveBeenCalledWith(
      'patient_id',
      'patient-1',
    )
  })

  it('maps persisted FDI data to the frontend model', () => {
    expect(mapOdontogramRecord(databaseEntry)).toEqual({
      id: 'entry-1',
      notes: 'Controlar lesión con ñ',
      patientId: 'patient-1',
      status: 'caries',
      surface: null,
      toothCode: '16',
      updatedAt: '2026-07-14T13:00:00.000Z',
    })
  })

  it('normalizes notes and upserts the same whole tooth scope', async () => {
    const input = {
      clinicId: 'clinic-1',
      notes: '  controlar   lesión con ñ  ',
      patientId: 'patient-1',
      status: 'caries' as const,
      surface: null,
      toothCode: '16' as const,
    }

    expect(mapSaveOdontogramInputToRecord(input)).toMatchObject({
      notes: 'Controlar lesión con ñ',
      patient_id: 'patient-1',
      tooth_code: '16',
    })

    await saveOdontogramEntry(input)

    expect(queryMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: 'clinic-1',
        patient_id: 'patient-1',
        surface: null,
        tooth_code: '16',
      }),
      { onConflict: 'clinic_id,patient_id,tooth_code,surface' },
    )
  })

  it('turns RLS failures into a friendly error', () => {
    expect(getOdontogramErrorMessage({ code: '42501' })).toBe(
      'No tienes permiso para acceder al odontograma.',
    )
  })
})
