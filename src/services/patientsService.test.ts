import { describe, expect, it } from 'vitest'

import type { PatientRecord } from '../types/database'
import {
  getPatientServiceErrorMessage,
  mapPatientFormValuesToPatientInput,
  mapPatientInputToPatientInsert,
  mapPatientInputToPatientUpdate,
  mapPatientRecordToPatient,
  parsePatientPage,
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
      countryCode: '+591',
      email: 'ana@example.com',
      firstName: 'Ana',
      fullName: 'Ana Salazar',
      lastName: 'Salazar',
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

  it('capitalizes compound names and cleans the phone before updating', () => {
    expect(
      mapPatientInputToPatientUpdate({
        countryCode: '+49',
        email: '  PACIENTE@EXAMPLE.COM ',
        firstName: '  maría  josé ',
        lastName: ' pérez  suarez ',
        localPhone: ' 170 123 4567 ',
      }),
    ).toEqual({
      birth_date: null,
      country_code: '+49',
      email: 'paciente@example.com',
      first_name: 'María José',
      last_name: 'Pérez Suarez',
      notes: null,
      phone: '+491701234567',
    })
  })
})

describe('patient page contract', () => {
  it('parses a bounded patient page and its stable cursor', () => {
    expect(
      parsePatientPage({
        pageInfo: {
          hasMore: true,
          nextCursor: {
            createdAt: '2026-08-05T12:00:00Z',
            id: 'patient-1',
          },
        },
        patients: [
          {
            birthDate: null,
            countryCode: '+591',
            email: 'ana@example.com',
            firstName: 'Ana',
            fullName: 'Ana Salazar',
            id: 'patient-1',
            lastName: 'Salazar',
            lastVisit: '2026-08-01',
            nextAppointment: '2026-08-12',
            phone: '+59176543210',
            status: 'active',
          },
        ],
      }),
    ).toEqual({
      pageInfo: {
        hasMore: true,
        nextCursor: {
          createdAt: '2026-08-05T12:00:00Z',
          id: 'patient-1',
        },
      },
      patients: [
        {
          birthDate: undefined,
          countryCode: '+591',
          email: 'ana@example.com',
          firstName: 'Ana',
          fullName: 'Ana Salazar',
          id: 'patient-1',
          lastName: 'Salazar',
          lastVisit: '2026-08-01',
          nextAppointment: '2026-08-12',
          phone: '+59176543210',
          status: 'active',
        },
      ],
    })
  })

  it('rejects malformed patient page payloads', () => {
    expect(
      parsePatientPage({
        pageInfo: { hasMore: false, nextCursor: null },
        patients: [{ id: 'patient-1' }],
      }),
    ).toBeNull()
  })

  it('maps normalized duplicate indexes to safe form messages', () => {
    expect(
      getPatientServiceErrorMessage({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "patients_clinic_phone_normalized_uidx"',
      }),
    ).toBe('El teléfono ya está registrado en otro paciente.')

    expect(
      getPatientServiceErrorMessage({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "patients_clinic_email_normalized_uidx"',
      }),
    ).toBe('El correo ya está registrado en otro paciente.')
  })
})
