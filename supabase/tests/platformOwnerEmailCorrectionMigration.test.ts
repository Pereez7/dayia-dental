import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../migrations/030_platform_owner_email_correction.sql',
    import.meta.url,
  ),
  'utf8',
).replaceAll('\r\n', '\n')

describe('platform owner email correction migration', () => {
  it('keeps an immutable audit trail outside authenticated access', () => {
    expect(migration).toContain(
      'create table if not exists public.platform_clinic_owner_corrections',
    )
    expect(migration).toContain(
      'alter table public.platform_clinic_owner_corrections enable row level security',
    )
    expect(migration).toContain(
      'revoke all on public.platform_clinic_owner_corrections\n  from public, anon, authenticated',
    )
    expect(migration).not.toMatch(
      /grant\s+(update|delete)[\s\S]{0,100}platform_clinic_owner_corrections/i,
    )
  })

  it('replaces only the expected owner of a pending clinic atomically', () => {
    expect(migration).toContain(
      'create or replace function public.replace_pending_platform_clinic_owner',
    )
    expect(migration).toContain("and clinics.status = 'pending_activation'")
    expect(migration).toContain(
      'and memberships.user_id = expected_owner_user_id',
    )
    expect(migration).toContain("status = 'inactive'")
    expect(migration).toContain("'pending_activation'")
    expect(migration).toContain(
      'raise exception \'OWNER_EMAIL_ALREADY_REGISTERED\'',
    )
  })

  it('restricts the correction RPC to service role', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain(
      ') from public, anon, authenticated',
    )
    expect(migration).toContain(
      ') to service_role',
    )
  })
})
