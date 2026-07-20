import { describe, expect, it } from 'vitest'
import type { Patient } from '../types/Patient'
import {
  getPatientFormValues,
  havePatientFormValuesChanged,
} from './patientForm'

const patient: Patient = {
  id: 'patient-1',
  birthDate: '1990-04-12',
  countryCode: '+49',
  email: 'fabricio@example.com',
  firstName: 'Fabricio',
  fullName: 'Fabricio Pérez Suarez',
  lastName: 'Pérez Suarez',
  lastVisit: 'Sin registro',
  nextAppointment: null,
  phone: '+491701234567',
  status: 'active',
}

describe('patientForm helpers', () => {
  it('preserves an existing phone with a manual country code', () => {
    expect(getPatientFormValues(patient)).toEqual({
      birthDate: '1990-04-12',
      countryCode: '+49',
      email: 'fabricio@example.com',
      firstName: 'Fabricio',
      lastName: 'Pérez Suarez',
      localPhone: '1701234567',
    })
  })

  it('detects when there are no effective changes', () => {
    expect(
      havePatientFormValuesChanged(patient, {
        ...getPatientFormValues(patient),
        email: ' FABRICIO@EXAMPLE.COM ',
        localPhone: '170 123 4567',
      }),
    ).toBe(false)
  })

  it('detects an actual patient change', () => {
    expect(
      havePatientFormValuesChanged(patient, {
        ...getPatientFormValues(patient),
        firstName: 'Fabio',
      }),
    ).toBe(true)
  })
})
