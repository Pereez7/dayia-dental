import { describe, expect, it } from 'vitest'
import type { Patient } from '../types/Patient'
import { filterPatients } from './patientFilters'

const patients: Patient[] = [
  {
    id: 1,
    fullName: 'Mariana Rojas',
    phone: '+591 70012345',
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-05',
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Carlos Medina',
    phone: '+591 71234567',
    lastVisit: '2026-04-29',
    nextAppointment: '2026-06-05',
    status: 'follow-up',
  },
]

describe('filterPatients', () => {
  it('returns all patients when search text is empty', () => {
    expect(filterPatients(patients, '')).toEqual(patients)
    expect(filterPatients(patients, '   ')).toEqual(patients)
  })

  it('filters patients by first name', () => {
    expect(filterPatients(patients, 'mariana')).toEqual([patients[0]])
  })

  it('filters patients by last name', () => {
    expect(filterPatients(patients, 'medina')).toEqual([patients[1]])
  })

  it('filters patients by phone', () => {
    expect(filterPatients(patients, '70012345')).toEqual([patients[0]])
  })

  it('returns an empty list when there are no matches', () => {
    expect(filterPatients(patients, 'sofia')).toEqual([])
  })
})
