import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../migrations/031_platform_admin_server_pagination.sql',
    import.meta.url,
  ),
  'utf8',
).replaceAll('\r\n', '\n')

describe('platform admin server pagination migration', () => {
  it('adds stable cursor indexes for clinics and both commercial histories', () => {
    expect(migration).toContain(
      'on public.clinics (created_at desc, id desc)',
    )
    expect(migration).toContain(
      'paid_at desc,\n    created_at desc,\n    id desc',
    )
    expect(migration).toContain(
      'on public.subscription_payment_submissions (\n    clinic_id,\n    status,\n    created_at desc,\n    id desc',
    )
  })

  it('applies scheduled plans once for a bounded clinic array', () => {
    expect(migration).toContain(
      'create or replace function public.apply_due_scheduled_plans',
    )
    expect(migration).toContain(
      'subscriptions.clinic_id = any(target_clinic_ids)',
    )
    expect(migration).toContain(
      "jsonb_build_object('scheduled', true, 'batch', true)",
    )
    expect(migration).toContain(
      'grant execute on function public.apply_due_scheduled_plans(uuid[])\n  to service_role',
    )
  })

  it('returns one keyset page with aggregate counters and no payment rows', () => {
    const summaryFunction = migration.slice(
      migration.indexOf(
        'create or replace function public.list_platform_clinic_summaries',
      ),
    )

    expect(summaryFunction).toContain(
      '(clinics.created_at, clinics.id) < (cursor_created_at, cursor_id)',
    )
    expect(summaryFunction).toContain('limit target_limit + 1')
    expect(summaryFunction).toContain(
      "submissions.status = 'pending_review'",
    )
    expect(summaryFunction).toContain(
      "memberships.status = 'active'",
    )
    expect(summaryFunction).not.toContain(
      'from public.subscription_payments payments',
    )
  })

  it('keeps both new administrative RPCs outside authenticated access', () => {
    expect(migration).toContain(
      'from public, anon, authenticated',
    )
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(
      /grant execute on function public\.(apply_due_scheduled_plans|list_platform_clinic_summaries)[\s\S]{0,160}to authenticated/i,
    )
  })
})
