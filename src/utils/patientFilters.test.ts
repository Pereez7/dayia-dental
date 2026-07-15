import { describe, expect, it } from 'vitest'
import type { Patient } from '../types/Patient'
import { filterPatients } from './patientFilters'

const patients: Patient[] = [
  {
    id: 1,
    email: 'mariana.rojas@dayia.test',
    fullName: 'Mariana Rojas',
    phone: '+59170012345',
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-05',
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Carlos Medina',
    phone: '+59171234567',
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

  it('filters patients by full name without requiring accents', () => {
    expect(filterPatients(patients, 'mariana rojas')).toEqual([patients[0]])
    expect(filterPatients(patients, 'Maríana')).toEqual([patients[0]])
  })

  it('filters patients by phone', () => {
    expect(filterPatients(patients, '70012345')).toEqual([patients[0]])
  })

  it('filters patients by email when available', () => {
    expect(filterPatients(patients, 'rojas@dayia')).toEqual([patients[0]])
  })

  it('returns an empty list when there are no matches', () => {
    expect(filterPatients(patients, 'sofia')).toEqual([])
  })
})
