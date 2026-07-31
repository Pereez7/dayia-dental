import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const listFunction = readFileSync(
  new URL('../functions/list-platform-clinics/index.ts', import.meta.url),
  'utf8',
)
const billingFunction = readFileSync(
  new URL(
    '../functions/get-platform-clinic-billing/index.ts',
    import.meta.url,
  ),
  'utf8',
)

describe('platform admin paginated Functions', () => {
  it('keeps the clinic summary independent from commercial histories', () => {
    expect(listFunction).toContain(
      "'list_platform_clinic_summaries'",
    )
    expect(listFunction).not.toContain(".from('subscription_payments')")
    expect(listFunction).not.toContain(
      ".from('subscription_payment_submissions')",
    )
    expect(listFunction).not.toContain(
      "rpc('apply_due_scheduled_plan'",
    )
  })

  it('loads histories only for one selected clinic and enforces page limits', () => {
    expect(billingFunction).toContain(
      ".eq('clinic_id', clinicId)",
    )
    expect(billingFunction).toContain('.limit(paymentLimit + 1)')
    expect(billingFunction).toContain('.limit(submissionLimit + 1)')
    expect(billingFunction).toContain('MAX_HISTORY_PAGE_SIZE = 25')
    expect(billingFunction).toContain(
      "'apply_due_scheduled_plans'",
    )
  })

  it('uses complete stable cursors for duplicate timestamps', () => {
    expect(billingFunction).toContain(
      'paid_at.eq.${cursor.paidAt},created_at.eq.${cursor.createdAt},id.lt.${cursor.id}',
    )
    expect(billingFunction).toContain(
      'created_at.eq.${cursor.createdAt},id.lt.${cursor.id}',
    )
  })
})
