import { describe, expect, it } from 'vitest'

import type { PatientRecord } from '../types/database'
import {
  mapPatientFormValuesToPatientInput,
  mapPatientInputToPatientInsert,
  mapPatientRecordToPatient,
} from './patientsService'

const patientRecord: PatientRecord = {
  birth_date: '1990-05-20',
  clinic_id: 'clinic-1',
  country_code: '+591',
  created_at: '2026-06-15T12:00:00Z',
  email: 'ana@example.com',
  first_name: 'Ana',
  id: 'patient-1',
  last_name: 'Salazar',
  notes: null,
  phone: '+59176543210',
  updated_at: '2026-06-15T12:00:00Z',
}

describe('patientsService mappers', () => {
  it('maps a patient record to the current frontend patient shape', () => {
    expect(mapPatientRecordToPatient(patientRecord)).toEqual({
      id: 'patient-1',
      birthDate: '1990-05-20',
      email: 'ana@example.com',
      fullName: 'Ana Salazar',
      lastVisit: 'Sin registro',
      nextAppointment: null,
      phone: '+59176543210',
      status: 'active',
    })
  })

  it('normalizes form values before sending them to Supabase', () => {
    const input = mapPatientFormValuesToPatientInput({
      birthDate: '',
      countryCode: '+591',
      email: '  ANA@EXAMPLE.COM ',
      firstName: '  ANA ',
      lastName: '  SALAZAR ',
      localPhone: ' 76543210 ',
    })

    expect(input).toEqual({
      birthDate: undefined,
      countryCode: '+591',
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Salazar',
      localPhone: '76543210',
    })
  })

  it('maps patient input to a clinic-scoped insert payload', () => {
    expect(
      mapPatientInputToPatientInsert('clinic-1', {
        birthDate: '1990-05-20',
        countryCode: '+591',
        email: '',
        firstName: 'ana',
        lastName: 'salazar',
        localPhone: '76543210',
      }),
    ).toEqual({
      birth_date: '1990-05-20',
      clinic_id: 'clinic-1',
      country_code: '+591',
      email: null,
      first_name: 'Ana',
      last_name: 'Salazar',
      notes: null,
      phone: '+59176543210',
    })
  })
})
