import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../migrations/033_bounded_clinic_dashboard.sql', import.meta.url),
  'utf8',
)
const service = readFileSync(
  new URL('../../src/services/dashboardService.ts', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8')

describe('bounded clinic dashboard contract', () => {
  it('authorizes the clinic before executing the fixed-size snapshot', () => {
    expect(migration).toContain(
      'not public.can_access_clinic_data(target_clinic_id)',
    )
    expect(migration).toContain('limit 5')
    expect(migration).toContain('limit 4')
    expect(migration).toContain('to authenticated')
    expect(migration).not.toMatch(
      /grant execute on function public\.get_clinic_dashboard_snapshot[\s\S]{0,150}to anon/i,
    )
  })

  it('uses ordered indexes for active appointments and recent activity', () => {
    expect(migration).toContain('appointments_clinic_active_schedule_idx')
    expect(migration).toContain(
      'appointment_change_logs_clinic_created_idx',
    )
    expect(migration).toContain('patients_clinic_created_idx')
  })

  it('loads the dashboard through one RPC instead of appointment table scans', () => {
    expect(service).toMatch(/\.rpc\(\s*'get_clinic_dashboard_snapshot'/)
    expect(service).not.toContain(".from('appointments')")
    expect(service).not.toContain(".select('*')")
    expect(app).toContain("effectiveActiveSection !== 'dashboard'")
    expect(app).toContain('sectionNeedsAppointments(effectiveActiveSection)')
    expect(app).toContain('sectionNeedsPatients(effectiveActiveSection)')
  })
})
