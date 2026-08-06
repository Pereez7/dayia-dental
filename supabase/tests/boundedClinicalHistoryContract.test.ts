import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const app = readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const migration = readFileSync(
  new URL('../migrations/037_bounded_clinical_history.sql', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')
const service = readFileSync(
  new URL('../../src/services/clinicalRecordsService.ts', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n')

describe('bounded clinical history contract', () => {
  it('provides stable cursor pages for patient and global history', () => {
    expect(migration).toContain(
      'create or replace function public.get_patient_clinical_records_page',
    )
    expect(migration).toContain(
      'create or replace function public.get_clinic_clinical_history_page',
    )
    expect(migration).toContain('limit target_page_size + 1')
    expect(migration).toContain('(records.record_date, records.id)')
    expect(migration).toContain("'nextCursor'")
  })

  it('indexes record cursors and normalized clinical search', () => {
    expect(migration).toContain('clinical_records_clinic_record_cursor_idx')
    expect(migration).toContain(
      'clinical_records_clinic_patient_record_cursor_idx',
    )
    expect(migration).toContain('clinical_records_search_trgm_idx')
    expect(migration).toContain('extensions.gin_trgm_ops')
  })

  it('routes both real views through bounded RPCs', () => {
    expect(app).toContain('getPatientClinicalRecordsPage')
    expect(app).toContain('getClinicClinicalHistoryPage')
    expect(app).not.toContain('listClinicalRecordsByClinic')
    expect(app).toContain("effectiveActiveSection === 'clinical-history'")

    const patientPageStart = service.indexOf(
      'export async function getPatientClinicalRecordsPage',
    )
    const globalPageStart = service.indexOf(
      'export async function getClinicClinicalHistoryPage',
    )
    const legacyListStart = service.indexOf(
      'export async function listClinicalRecordsByClinic',
    )
    const patientPageService = service.slice(patientPageStart, globalPageStart)
    const globalPageService = service.slice(globalPageStart, legacyListStart)

    expect(patientPageService).toContain("'get_patient_clinical_records_page'")
    expect(globalPageService).toContain("'get_clinic_clinical_history_page'")
    expect(patientPageService).not.toContain(".from('clinical_records')")
    expect(globalPageService).not.toContain(".from('clinical_records')")
  })

  it('does not load all patients to build the global history view', () => {
    const needsPatientsStart = app.indexOf('const sectionNeedsPatients')
    const needsPatientsEnd = app.indexOf('\n  const', needsPatientsStart + 10)
    const sectionNeedsPatients = app.slice(needsPatientsStart, needsPatientsEnd)

    expect(sectionNeedsPatients).not.toContain("'clinical-history'")
    expect(app).toContain('globalClinicalHistoryGroups')
    expect(app).toContain('handleLoadMoreGlobalClinicalHistory')
    expect(app).toContain('handleLoadMoreClinicalRecords')
  })
})
