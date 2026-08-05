import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const app = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const migration = readFileSync(
  new URL('../migrations/036_bounded_clinic_patients.sql', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const service = readFileSync(
  new URL('../../src/services/patientsService.ts', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')

describe('bounded patients contract', () => {
  it('provides a fixed server page and stable creation cursor', () => {
    expect(migration).toContain(
      'create or replace function public.get_clinic_patients_page',
    )
    expect(migration).toContain('limit target_page_size + 1')
    expect(migration).toContain('(patients.created_at, patients.id)')
    expect(migration).toContain("'nextCursor'")
  })

  it('indexes normalized search and authoritative duplicates', () => {
    expect(migration).toContain('patients_search_trgm_idx')
    expect(migration).toContain('extensions.gin_trgm_ops')
    expect(migration).toContain('patients_clinic_phone_normalized_uidx')
    expect(migration).toContain('patients_clinic_email_normalized_uidx')
  })

  it('routes the real list through the RPC with explicit detail columns', () => {
    const pageStart = service.indexOf('export async function getPatientsPage')
    const detailStart = service.indexOf('export async function getPatientById')
    const pageService = service.slice(pageStart, detailStart)

    expect(pageService).toContain(".rpc(\n    'get_clinic_patients_page'")
    expect(pageService).not.toContain(".from('patients')")
    expect(service).not.toContain(".select('*')")
  })

  it('keeps the patient page separate from consumers assigned to later subhitos', () => {
    expect(app).toContain('patientListItems')
    expect(app).toContain('patientListNextCursor')
    expect(app).toContain("effectiveActiveSection !== 'patients-list'")
    expect(app).toContain("effectiveActiveSection === 'patient-detail'")
    expect(app).toContain('getAppointmentsByPatient')
  })
})
