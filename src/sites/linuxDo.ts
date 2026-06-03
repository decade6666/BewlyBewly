const LINUX_DO_ORIGIN = 'https://linux.do'
const LINUX_DO_GUIDELINE_BANNER_TEXT = '真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》'
const TOPIC_LIST_PATHS = new Set(['', '/latest', '/top', '/hot'])
const CATEGORY_PATH_PATTERN = /^\/c(?:\/[^/]+)+$/
const TOPIC_PATH_PATTERN = /^\/t\/[^/]+\/\d+(?:\/\d+)?$/
const GUIDELINE_TEXT_SELECTOR = [
  '[role="banner"]',
  '.welcome-banner',
  '.discourse-banner',
  '.custom-homepage-banner',
  '.banner',
  '.notice',
  '.alert',
  'section',
  'div',
  'p',
].join(', ')
const GUIDELINE_CONTAINER_SELECTOR = [
  '[role="banner"]',
  '.welcome-banner',
  '.discourse-banner',
  '.custom-homepage-banner',
  '.banner',
  '.notice',
  '.alert',
  'section',
].join(', ')
const TOPIC_ROW_SELECTOR = [
  'tr.topic-list-item',
  '.topic-list-item',
  '[class*="topic-list-item" i]',
  '[class*="topic-card" i]',
  '[class*="topic-item" i]',
  'article',
].join(', ')
const PINNED_TOPIC_MARKER_SELECTOR = [
  '.pinned',
  '[class*="pinned" i]',
  '[class*="thumbtack" i]',
  '.topic-status-pinned',
  '.d-icon-thumbtack',
  '.d-icon-far-thumbtack',
  '[data-pinned="true"]',
  '[aria-label*="置顶"]',
  '[aria-label*="pinned" i]',
  '[title*="置顶"]',
  '[title*="pinned" i]',
  '[href*="thumbtack" i]',
  '[xlink\\:href*="thumbtack" i]',
].join(', ')
const PINNED_TOPIC_TEXT_MARKER_SELECTOR = 'span, div, a, button'
const PINNED_TOPIC_TEXT_MARKER_PATTERN = /^(?:已?置顶|pinned)$/i

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

  return normalizePathname(parsedUrl.pathname) === ''
}

export function hideLinuxDoHomePageElements(root: ParentNode, url: string): void {
  if (!isLinuxDoHomePage(url))
    return

  hideGuidelineBanner(root)
  hidePinnedTopicRows(root)
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

function hideGuidelineBanner(root: ParentNode): void {
  const guidelineTextElement = Array.from(root.querySelectorAll<HTMLElement>(GUIDELINE_TEXT_SELECTOR))
    .filter(hasGuidelineBannerText)
    .find(element => !Array.from(element.children).some(hasGuidelineBannerText))

  if (!guidelineTextElement)
    return

  hideElement(findGuidelineBannerContainer(guidelineTextElement))
}

function hasGuidelineBannerText(element: Element): boolean {
  return normalizeTextForMatching(element.textContent ?? '').includes(normalizeTextForMatching(LINUX_DO_GUIDELINE_BANNER_TEXT))
}

function findGuidelineBannerContainer(element: HTMLElement): HTMLElement {
  let container = element
  let containerText = normalizeTextForMatching(container.textContent ?? '')

  for (let parent = container.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const parentText = normalizeTextForMatching(parent.textContent ?? '')

    if (parentText !== containerText)
      break

    container = parent
    containerText = parentText
  }

  const explicitContainer = element.closest<HTMLElement>(GUIDELINE_CONTAINER_SELECTOR)

  if (explicitContainer && normalizeTextForMatching(explicitContainer.textContent ?? '') === containerText)
    return explicitContainer

  return container
}

function hidePinnedTopicRows(root: ParentNode): void {
  Array.from(root.querySelectorAll<HTMLElement>(TOPIC_ROW_SELECTOR))
    .filter(isPinnedTopicRow)
    .forEach(hideElement)
}

function isPinnedTopicRow(row: HTMLElement): boolean {
  return row.classList.contains('pinned')
    || row.matches('[data-pinned="true"], [aria-label*="置顶"], [aria-label*="pinned" i], [title*="置顶"], [title*="pinned" i]')
    || row.querySelector(PINNED_TOPIC_MARKER_SELECTOR) !== null
    || Array.from(row.querySelectorAll<HTMLElement>(PINNED_TOPIC_TEXT_MARKER_SELECTOR)).some(hasPinnedTopicTextMarker)
}

function hasPinnedTopicTextMarker(element: Element): boolean {
  return PINNED_TOPIC_TEXT_MARKER_PATTERN.test(normalizeTextForMatching(element.textContent ?? ''))
    && !Array.from(element.children).some(hasPinnedTopicTextMarker)
}

function hideElement(element: HTMLElement): void {
  if (element.style.getPropertyValue('display') === 'none' && element.style.getPropertyPriority('display') === 'important')
    return

  element.style.setProperty('display', 'none', 'important')
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
