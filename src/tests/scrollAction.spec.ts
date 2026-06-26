import { describe, expect, it } from 'vitest'

import { resolveScrollAction } from '../contentScripts/scrollAction'

describe('resolveScrollAction', () => {
  it('smooth-scrolls to top when not at top, regardless of refresh state', () => {
    expect(resolveScrollAction(false, false)).toBe('smooth-scroll-top')
    expect(resolveScrollAction(false, true)).toBe('smooth-scroll-top')
  })

  it('scrolls to top after an in-place list refresh was triggered', () => {
    expect(resolveScrollAction(true, true)).toBe('refresh-list-scroll-top')
  })

  it('reloads the page when at top and no list refresh was triggered', () => {
    expect(resolveScrollAction(true, false)).toBe('reload')
  })
})
