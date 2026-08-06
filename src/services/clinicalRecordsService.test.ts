import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMocks = vi.hoisted(() => {
  const order = vi.fn()
  const patientEq = vi.fn(() => ({ order }))
  const clinicEq = vi.fn(() => ({ eq: patientEq, order }))
  const select = vi.fn(() => ({ eq: clinicEq }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn()

  return { clinicEq, from, order, patientEq, rpc, select }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: queryMocks.from, rpc: queryMocks.rpc },
}))

import {
  getClinicClinicalHistoryPage,
  getClinicalRecordsErrorMessage,
  getPatientClinicalRecordsPage,
  listClinicalRecordsByPatient,
  mapClinicalRecordFormToCreateInput,
  mapClinicalRecordRecord,
  mapCreateClinicalRecordInputToRecord,
} from './clinicalRecordsService'

describe('clinical records service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMocks.order.mockResolvedValue({ data: [], error: null })
    queryMocks.rpc.mockResolvedValue({ data: null, error: null })
  })

  it('requests one bounded patient page with a stable cursor', async () => {
    queryMocks.rpc.mockResolvedValueOnce({
      data: {
        pageInfo: { hasMore: false, nextCursor: null },
        records: [],
        summary: {
          firstRecordDate: null,
          lastRecordDate: null,
          totalRecords: 0,
        },
      },
      error: null,
    })

    await getPatientClinicalRecordsPage('clinic-1', 'patient-1', {
      cursor: {
        id: 'record-8',
        recordDate: '2026-08-05T12:00:00.000Z',
      },
    })

    expect(queryMocks.rpc).toHaveBeenCalledWith(
      'get_patient_clinical_records_page',
      expect.objectContaining({
        target_after_id: 'record-8',
        target_after_record_date: '2026-08-05T12:00:00.000Z',
        target_clinic_id: 'clinic-1',
        target_page_size: 8,
        target_patient_id: 'patient-1',
      }),
    )
  })

  it('normalizes timestamp summaries before they reach date-only UI formatters', async () => {
    queryMocks.rpc.mockResolvedValueOnce({
      data: {
        pageInfo: { hasMore: false, nextCursor: null },
        records: [
          {
            date: '2026-08-05T12:00:00.000Z',
            diagnosis: 'Gingivitis',
            id: 'record-1',
            notes: '',
            patientId: 'patient-1',
            reason: 'Control',
            treatment: 'Profilaxis',
          },
        ],
        summary: {
          firstRecordDate: '2025-01-10T12:00:00.000Z',
          lastRecordDate: '2026-08-05T12:00:00.000Z',
          totalRecords: 18,
        },
      },
      error: null,
    })

    const result = await getPatientClinicalRecordsPage(
      'clinic-1',
      'patient-1',
    )

    expect(result.data?.summary).toEqual({
      firstRecordDate: '2025-01-10',
      lastRecordDate: '2026-08-05',
      totalRecords: 18,
    })
    expect(result.data?.records[0]?.date).toBe('2026-08-05')
  })

  it('requests global search and period filtering from PostgreSQL', async () => {
    queryMocks.rpc.mockResolvedValueOnce({
      data: {
        groups: [],
        pageInfo: { hasMore: false, nextCursor: null },
        summary: {
          patientsWithHistory: 0,
          recordsThisMonth: 0,
          totalRecords: 0,
        },
      },
      error: null,
    })

    await getClinicClinicalHistoryPage(
      'clinic-1',
      'gingivitis',
      'last-30-days',
      '2026-08-05',
    )

    expect(queryMocks.rpc).toHaveBeenCalledWith(
      'get_clinic_clinical_history_page',
      expect.objectContaining({
        target_clinic_id: 'clinic-1',
        target_page_size: 8,
        target_period: 'last-30-days',
        target_reference_date: '2026-08-05',
        target_search: 'gingivitis',
      }),
    )
  })

  it('rejects malformed bounded payloads safely', async () => {
    queryMocks.rpc.mockResolvedValueOnce({
      data: { pageInfo: {}, records: 'not-an-array', summary: {} },
      error: null,
    })

    await expect(
      getPatientClinicalRecordsPage('clinic-1', 'patient-1'),
    ).resolves.toEqual({
      data: null,
      error: 'No pudimos interpretar el historial clínico.',
    })
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
