import { describe, expect, it } from 'vitest'

import { canReuseSessionContext } from './sessionContextLifecycle'

describe('session context lifecycle', () => {
  it('reuses the resolved context for auth refreshes from the same user', () => {
    expect(canReuseSessionContext('user-1', 'user-1')).toBe(true)
  })

  it('reloads the context when the authenticated user changes', () => {
    expect(canReuseSessionContext('user-1', 'user-2')).toBe(false)
  })

  it('does not reuse context before a user has been resolved', () => {
    expect(canReuseSessionContext(null, 'user-1')).toBe(false)
    expect(canReuseSessionContext('user-1', null)).toBe(false)
  })
})
