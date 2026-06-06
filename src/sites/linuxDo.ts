const LINUX_DO_ORIGIN = 'https://linux.do'
const TOPIC_LIST_PATHS = new Set(['', '/latest', '/top', '/hot'])
const HOME_PAGE_PATHS = new Set(['', '/latest'])
const CATEGORY_PATH_PATTERN = /^\/c(?:\/[^/]+)+$/
const TOPIC_PATH_PATTERN = /^\/t\/[^/]+\/\d+(?:\/\d+)?$/
// Linux.do body classes can include topic-card tokens, so constrain hiding to topic list items.
const TOPIC_ITEM_SELECTOR = [
  'tr.topic-list-item',
  'li.topic-list-item',
  'article.topic-list-item',
  '.topic-list .topic-list-item',
  '.latest-topic-list .topic-list-item',
  '.top-topic-list .topic-list-item',
  '[data-topic-id].topic-list-item',
].join(', ')
const PINNED_TOPIC_MARKER_SELECTOR = [
  '.pinned',
  '[class*="pinned" i]',
  '[class*="thumbtack" i]',
  '.topic-status-pinned',
  '.d-icon-thumbtack',
  '.d-icon-far-thumbtack',
  '[data-pinned="true"]',
  '[data-topic-pinned="true"]',
  '[data-pinned-globally="true"]',
  '[aria-label*="置顶"]',
  '[aria-label*="pinned" i]',
  '[title*="置顶"]',
  '[title*="pinned" i]',
  '[href*="thumbtack" i]',
  '[xlink\\:href*="thumbtack" i]',
].join(', ')
const PINNED_TOPIC_ITEM_SELF_SELECTOR = [
  '[class*="pinned" i]',
  '[data-pinned="true"]',
  '[data-topic-pinned="true"]',
  '[data-pinned-globally="true"]',
  '[aria-label*="置顶"]',
  '[aria-label*="pinned" i]',
  '[title*="置顶"]',
  '[title*="pinned" i]',
].join(', ')
const PINNED_TOPIC_TEXT_MARKER_SELECTOR = 'span, div, a, button'
const PINNED_TOPIC_TEXT_MARKER_PATTERN = /(?:^|[\s·|:：])(?:已?置顶|pinned)(?:$|[\s·|:：])/i
const HOME_PAGE_HIDDEN_ELEMENT_ATTR = 'data-bewly-home-page-hidden'
const HOME_PAGE_PREVIOUS_DISPLAY_ATTR = 'data-bewly-home-page-previous-display'
const HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR = 'data-bewly-home-page-previous-display-priority'

type HomePageHiddenElementKind = 'pinned-topic'

export function isLinuxDoTopicListPage(url: string): boolean {
  const parsedUrl = parseLinuxDoUrl(url)

  if (!parsedUrl)
    return false

  const pathname = normalizePathname(parsedUrl.pathname)

  return TOPIC_LIST_PATHS.has(pathname) || CATEGORY_PATH_PATTERN.test(pathname)
}

export function isLinuxDoHomePage(url: string): boolean {
  const parsedUrl = parseLinuxDoUrl(url)

  if (!parsedUrl)
    return false

  return HOME_PAGE_PATHS.has(normalizePathname(parsedUrl.pathname))
}

export interface LinuxDoHomePageCleanupOptions {
  hidePinnedTopics: boolean
}

const DEFAULT_HOME_PAGE_CLEANUP_OPTIONS: LinuxDoHomePageCleanupOptions = {
  hidePinnedTopics: true,
}

export function hideLinuxDoHomePageElements(
  root: ParentNode,
  url: string,
  options: LinuxDoHomePageCleanupOptions = DEFAULT_HOME_PAGE_CLEANUP_OPTIONS,
): void {
  if (!isLinuxDoHomePage(url))
    return

  if (options.hidePinnedTopics)
    hidePinnedTopicRows(root)
  else
    restoreHiddenElements(root, 'pinned-topic')
}

export function normalizeLinuxDoTopicUrl(input: string, baseUrl: string): string | null {
  const parsedUrl = parseLinuxDoUrl(input, baseUrl)

  if (!parsedUrl)
    return null

  parsedUrl.pathname = normalizePathname(parsedUrl.pathname)

  if (!TOPIC_PATH_PATTERN.test(parsedUrl.pathname))
    return null

  return parsedUrl.toString()
}

export function findLinuxDoTopicLink(target: EventTarget | null, baseUrl: string): string | null {
  if (!(target instanceof Element))
    return null

  const link = target.closest<HTMLAnchorElement>('a[href]')

  if (!link)
    return null

  const href = link.getAttribute('href')

  if (!href)
    return null

  return normalizeLinuxDoTopicUrl(href, baseUrl)
}

function hidePinnedTopicRows(root: ParentNode): void {
  Array.from(root.querySelectorAll<HTMLElement>(TOPIC_ITEM_SELECTOR))
    .filter(isPinnedTopicItem)
    .forEach(element => hideElement(element, 'pinned-topic'))
}

function isPinnedTopicItem(element: HTMLElement): boolean {
  return element.classList.contains('pinned')
    || element.matches(PINNED_TOPIC_ITEM_SELF_SELECTOR)
    || element.querySelector(PINNED_TOPIC_MARKER_SELECTOR) !== null
    || Array.from(element.querySelectorAll<HTMLElement>(PINNED_TOPIC_TEXT_MARKER_SELECTOR)).some(hasPinnedTopicTextMarker)
}

function hasPinnedTopicTextMarker(element: Element): boolean {
  return PINNED_TOPIC_TEXT_MARKER_PATTERN.test(normalizeTextForMatching(element.textContent ?? ''))
    && !Array.from(element.children).some(hasPinnedTopicTextMarker)
}

function hideElement(element: HTMLElement, kind: HomePageHiddenElementKind): void {
  if (element.getAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR) !== kind) {
    element.setAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR, kind)
    element.setAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR, element.style.getPropertyValue('display'))
    element.setAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR, element.style.getPropertyPriority('display'))
  }

  if (element.style.getPropertyValue('display') === 'none' && element.style.getPropertyPriority('display') === 'important')
    return

  element.style.setProperty('display', 'none', 'important')
}

function restoreHiddenElements(root: ParentNode, kind: HomePageHiddenElementKind): void {
  Array.from(root.querySelectorAll<HTMLElement>(`[${HOME_PAGE_HIDDEN_ELEMENT_ATTR}="${kind}"]`))
    .forEach(restoreHiddenElement)
}

function restoreHiddenElement(element: HTMLElement): void {
  const previousDisplay = element.getAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR) ?? ''
  const previousDisplayPriority = element.getAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR) ?? ''

  if (previousDisplay)
    element.style.setProperty('display', previousDisplay, previousDisplayPriority)
  else
    element.style.removeProperty('display')

  element.removeAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR)
  element.removeAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR)
  element.removeAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR)
}

function normalizeTextForMatching(text: string): string {
  return text.replace(/\s+/g, '')
}

function parseLinuxDoUrl(input: string, baseUrl?: string): URL | null {
  try {
    const parsedUrl = baseUrl ? new URL(input, baseUrl) : new URL(input)

    if (parsedUrl.origin !== LINUX_DO_ORIGIN)
      return null

    return parsedUrl
  }
  catch {
    return null
  }
}

function normalizePathname(pathname: string): string {
  const normalizedPathname = pathname.replace(/\/+$/, '')

  return normalizedPathname === '/' ? '' : normalizedPathname
}
