import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../migrations/032_atomic_platform_clinic_creation.sql',
    import.meta.url,
  ),
  'utf8',
).replaceAll('\r\n', '\n')
const createFunction = readFileSync(
  new URL('../functions/create-platform-clinic/index.ts', import.meta.url),
  'utf8',
)
const functionRoot = new URL('../functions', import.meta.url)

describe('atomic platform clinic creation', () => {
  it('uses global normalized uniqueness and a restricted idempotency ledger', () => {
    expect(migration).toContain(
      'create unique index if not exists profiles_normalized_email_unique_idx',
    )
    expect(migration).toContain(
      'platform_clinic_creation_requester_payload_idx',
    )
    expect(migration).toContain(
      "status in ('reserved', 'completed')",
    )
    expect(migration).toContain(
      'alter table public.platform_clinic_creation_requests enable row level security',
    )
  })

  it('uses the native indexed Auth email predicate instead of an expression scan', () => {
    const lookup = migration.slice(
      migration.indexOf(
        'create or replace function public.lookup_auth_user_by_email',
      ),
      migration.indexOf(
        'create or replace function public.begin_platform_clinic_creation',
      ),
    )

    expect(lookup).toContain('users.email = normalized_email')
    expect(lookup).toContain('users.is_sso_user = false')
    expect(lookup).not.toContain('lower(btrim(users.email))')
  })

  it('validates commercial configuration before reserving or creating resources', () => {
    const planLookup = migration.indexOf('select plans.*')
    const requestInsert = migration.indexOf(
      'insert into public.platform_clinic_creation_requests',
    )
    const clinicInsert = migration.indexOf(
      'insert into public.clinics',
    )

    expect(planLookup).toBeGreaterThan(0)
    expect(requestInsert).toBeGreaterThan(planLookup)
    expect(clinicInsert).toBeGreaterThan(requestInsert)
  })

  it('commits clinic, profile, membership and subscription in one RPC', () => {
    const completion = migration.slice(
      migration.indexOf(
        'create or replace function public.complete_platform_clinic_creation',
      ),
      migration.indexOf(
        'create or replace function public.fail_platform_clinic_creation',
      ),
    )

    expect(completion).toContain('insert into public.clinics')
    expect(completion).toContain('insert into public.profiles')
    expect(completion).toContain('insert into public.clinic_memberships')
    expect(completion).toContain('insert into public.clinic_subscriptions')
    expect(completion).not.toContain('commit;')
  })

  it('keeps creation RPCs restricted to service role', () => {
    expect(migration).toContain(
      'from public, anon, authenticated',
    )
    expect(migration).not.toMatch(
      /grant execute on function public\.(begin|complete|fail|get)_platform_clinic_creation[\s\S]{0,180}to authenticated/i,
    )
  })

  it('uses the operation id, Auth ownership metadata and atomic RPCs', () => {
    expect(createFunction).toContain('requestId: operationId')
    expect(createFunction).toContain('dayia_creation_request_id: requestId')
    expect(createFunction).toContain("'begin_platform_clinic_creation'")
    expect(createFunction).toContain("'complete_platform_clinic_creation'")
    expect(createFunction).not.toContain(".from('clinics').insert")
    expect(createFunction).not.toContain(
      ".from('clinic_memberships').insert",
    )
  })

  it('contains no paginated Auth user scan in any Edge Function', () => {
    const sources = readTypeScriptFiles(functionRoot.pathname)
    const offenders = sources.filter(({ content }) =>
      content.includes('.listUsers('),
    )

    expect(offenders.map(({ path }) => path)).toEqual([])
  })
})

function readTypeScriptFiles(root: string) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)

    if (entry.isDirectory()) {
      return readTypeScriptFiles(path)
    }

    if (!entry.name.endsWith('.ts')) {
      return []
    }

    return [{ content: readFileSync(path, 'utf8'), path }]
  })
}
