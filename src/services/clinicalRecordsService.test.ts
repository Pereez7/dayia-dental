import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const order = vi.fn()
  const patientEq = vi.fn(() => ({ order }))
  const clinicEq = vi.fn(() => ({ eq: patientEq, order }))
  const select = vi.fn(() => ({ eq: clinicEq }))
  const from = vi.fn(() => ({ select }))

  return { clinicEq, from, order, patientEq, select }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from },
}))

import {
  getClinicalRecordsErrorMessage,
  listClinicalRecordsByPatient,
  mapClinicalRecordFormToCreateInput,
  mapClinicalRecordRecord,
  mapCreateClinicalRecordInputToRecord,
} from './clinicalRecordsService'

describe('clinical records service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.order.mockResolvedValue({ data: [], error: null })
  })

  it('scopes patient history by clinic_id and patient_id', async () => {
    await listClinicalRecordsByPatient('clinic-1', 'patient-1')

    expect(queryMocks.from).toHaveBeenCalledWith('clinical_records')
    expect(queryMocks.clinicEq).toHaveBeenCalledWith('clinic_id', 'clinic-1')
    expect(queryMocks.patientEq).toHaveBeenCalledWith(
      'patient_id',
      'patient-1',
    )
    expect(queryMocks.order).toHaveBeenCalledWith('record_date', {
      ascending: false,
    })
  })

  it('maps database observations to the frontend notes field', () => {
    expect(
      mapClinicalRecordRecord({
        clinic_id: 'clinic-1',
        created_at: '2026-07-14T12:00:00.000Z',
        created_by: 'doctor-1',
        diagnosis: 'Caries activa',
        id: 'record-1',
        observations: 'Control en siete días',
        patient_id: 'patient-1',
        reason: 'Dolor dental',
        record_date: '2026-07-14T12:00:00.000Z',
        treatment: 'Curación dental',
        updated_at: '2026-07-14T12:00:00.000Z',
      }),
    ).toEqual({
      date: '2026-07-14',
      diagnosis: 'Caries activa',
      id: 'record-1',
      notes: 'Control en siete días',
      patientId: 'patient-1',
      reason: 'Dolor dental',
      treatment: 'Curación dental',
    })
  })

  it('normalizes clinical text before building the insert payload', () => {
    const input = mapClinicalRecordFormToCreateInput(
      'clinic-1',
      'patient-1',
      {
        date: '2026-07-14',
        diagnosis: ' CARIES   ACTIVA ',
        notes: 'control   en siete días',
        reason: ' dolor   dental ',
        treatment: ' CURACION   DENTAL ',
      },
    )

    expect(input).toMatchObject({
      diagnosis: 'Caries activa',
      observations: 'Control en siete días',
      reason: 'Dolor dental',
      treatment: 'Curacion dental',
    })
    expect(mapCreateClinicalRecordInputToRecord(input)).toMatchObject({
      clinic_id: 'clinic-1',
      patient_id: 'patient-1',
      record_date: '2026-07-14T12:00:00.000Z',
    })
  })

  it('turns RLS failures into a friendly error', () => {
    expect(getClinicalRecordsErrorMessage({ code: '42501' })).toBe(
      'No tienes permiso para acceder al historial clínico.',
    )
  })
})
