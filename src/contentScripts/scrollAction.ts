export type ScrollActionKind = 'smooth-scroll-top' | 'refresh-list-scroll-top' | 'reload'

// Pure decision: given whether the page is at top and whether an in-place list
// refresh was already triggered, decide what the floating button should do.
export function resolveScrollAction(isAtTop: boolean, listRefreshTriggered: boolean): ScrollActionKind {
  if (!isAtTop)
    return 'smooth-scroll-top'

  return listRefreshTriggered ? 'refresh-list-scroll-top' : 'reload'
}
