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
const HOME_PAGE_HIDDEN_KIND_SEPARATOR = ' '
const HOME_PAGE_PREVIOUS_DISPLAY_ATTR = 'data-bewly-home-page-previous-display'
const HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR = 'data-bewly-home-page-previous-display-priority'
// Discourse adds a `tag-{name}` class to each topic row; rebuild visible tag links from it.
const TOPIC_TAG_CLASS_PATTERN = /^tag-(.+)$/
const INJECTED_TAG_CONTAINER_ATTR = 'data-bewly-topic-tags'
const INJECTED_TAG_MARKER_ATTR = 'data-bewly-topic-tag'
const CATEGORY_LINK_SELECTOR = 'a[href^="/c/"]'
const TOPIC_TITLE_BOTTOM_LINE_SELECTOR = '.link-bottom-line'

type HomePageHiddenElementKind = 'pinned-topic' | 'blocked-word'
type HomePageBlockedWordMatcher = (text: string) => boolean

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
  enableBlockedWords?: boolean
  blockedWords?: string[]
}

const DEFAULT_HOME_PAGE_CLEANUP_OPTIONS: LinuxDoHomePageCleanupOptions = {
  hidePinnedTopics: true,
  enableBlockedWords: false,
  blockedWords: [],
}

export function hideLinuxDoHomePageElements(
  root: ParentNode,
  url: string,
  options: LinuxDoHomePageCleanupOptions = DEFAULT_HOME_PAGE_CLEANUP_OPTIONS,
): void {
  if (!isLinuxDoHomePage(url))
    return

  const cleanupOptions = {
    ...DEFAULT_HOME_PAGE_CLEANUP_OPTIONS,
    ...options,
  }

  if (cleanupOptions.hidePinnedTopics)
    hidePinnedTopicRows(root)
  else
    restoreHiddenElements(root, 'pinned-topic')

  if (cleanupOptions.enableBlockedWords)
    applyBlockedWordFiltering(root, cleanupOptions.blockedWords ?? [])
  else
    restoreHiddenElements(root, 'blocked-word')
}

export function renderLinuxDoHomePageTopicTags(root: ParentNode, url: string, enabled: boolean): void {
  if (!isLinuxDoHomePage(url))
    return

  if (!enabled) {
    removeInjectedTopicTags(root)
    return
  }

  Array.from(root.querySelectorAll<HTMLElement>(TOPIC_ITEM_SELECTOR))
    .forEach(syncTopicItemTags)
}

function syncTopicItemTags(element: HTMLElement): void {
  const desiredTags = getTopicTagNames(element)
  const existingContainer = element.querySelector<HTMLElement>(`[${INJECTED_TAG_CONTAINER_ATTR}]`)
  const currentTags = existingContainer ? getInjectedTagNames(existingContainer) : []

  // compare-before-mutate: skip when nothing changes so injection never retriggers the observer.
  if (areTagListsEqual(desiredTags, currentTags))
    return

  if (existingContainer)
    existingContainer.remove()

  if (desiredTags.length === 0)
    return

  const anchor = resolveTagInsertionAnchor(element)

  if (!anchor)
    return

  const container = buildTopicTagContainer(element.ownerDocument, desiredTags)
  anchor.parent.insertBefore(container, anchor.refNode)
}

function getTopicTagNames(element: HTMLElement): string[] {
  return Array.from(element.classList)
    .map(token => TOPIC_TAG_CLASS_PATTERN.exec(token)?.[1])
    .filter((name): name is string => Boolean(name))
}

function getInjectedTagNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`[${INJECTED_TAG_MARKER_ATTR}]`))
    .map(link => link.textContent ?? '')
}

function areTagListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function resolveTagInsertionAnchor(element: HTMLElement): { parent: Element, refNode: Node | null } | null {
  const badgeAnchor = element.querySelector<HTMLAnchorElement>(CATEGORY_LINK_SELECTOR)

  if (badgeAnchor?.parentElement)
    return { parent: badgeAnchor.parentElement, refNode: badgeAnchor.nextSibling }

  const bottomLine = element.querySelector<HTMLElement>(TOPIC_TITLE_BOTTOM_LINE_SELECTOR)

  if (bottomLine)
    return { parent: bottomLine, refNode: null }

  return null
}

function buildTopicTagContainer(doc: Document, tagNames: string[]): HTMLElement {
  const container = doc.createElement('span')

  container.className = 'discourse-tags bewly-injected-tags'
  container.setAttribute(INJECTED_TAG_CONTAINER_ATTR, '')

  tagNames.forEach((name) => {
    const link = doc.createElement('a')

    link.className = 'discourse-tag box'
    link.setAttribute(INJECTED_TAG_MARKER_ATTR, '')
    link.setAttribute('href', `/tag/${encodeURIComponent(name)}`)
    link.textContent = name
    container.appendChild(link)
  })

  return container
}

function removeInjectedTopicTags(root: ParentNode): void {
  Array.from(root.querySelectorAll<HTMLElement>(`[${INJECTED_TAG_CONTAINER_ATTR}]`))
    .forEach(container => container.remove())
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

function applyBlockedWordFiltering(root: ParentNode, blockedWords: string[]): void {
  const matchers = createBlockedWordMatchers(blockedWords)

  if (matchers.length === 0) {
    restoreHiddenElements(root, 'blocked-word')
    return
  }

  Array.from(root.querySelectorAll<HTMLElement>(TOPIC_ITEM_SELECTOR))
    .forEach((element) => {
      if (doesElementMatchBlockedWords(element, matchers))
        hideElement(element, 'blocked-word')
      else
        restoreHiddenElementKind(element, 'blocked-word')
    })
}

function doesElementMatchBlockedWords(element: HTMLElement, matchers: HomePageBlockedWordMatcher[]): boolean {
  const text = element.textContent ?? ''

  return matchers.some(matcher => matcher(text))
}

function createBlockedWordMatchers(blockedWords: string[]): HomePageBlockedWordMatcher[] {
  return blockedWords
    .map(createBlockedWordMatcher)
    .filter((matcher): matcher is HomePageBlockedWordMatcher => matcher !== null)
}

function createBlockedWordMatcher(blockedWord: string): HomePageBlockedWordMatcher | null {
  const normalizedBlockedWord = blockedWord.trim()

  if (!normalizedBlockedWord)
    return null

  if (isRegexBlockedWord(normalizedBlockedWord))
    return createRegexBlockedWordMatcher(normalizedBlockedWord.slice(1, -1))

  const normalizedKeyword = normalizedBlockedWord.toLowerCase()

  return text => text.toLowerCase().includes(normalizedKeyword)
}

function createRegexBlockedWordMatcher(pattern: string): HomePageBlockedWordMatcher | null {
  if (!pattern)
    return null

  try {
    const regex = new RegExp(pattern, 'i')

    return text => regex.test(text)
  }
  catch {
    return null
  }
}

function isRegexBlockedWord(blockedWord: string): boolean {
  return blockedWord.startsWith('/') && blockedWord.endsWith('/') && blockedWord.length > 2
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
  const hiddenKinds = getHiddenElementKinds(element)
  const nextHiddenKinds = hiddenKinds.includes(kind) ? hiddenKinds : [...hiddenKinds, kind]

  if (hiddenKinds.length === 0) {
    element.setAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR, element.style.getPropertyValue('display'))
    element.setAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR, element.style.getPropertyPriority('display'))
  }

  const nextHiddenKindValue = nextHiddenKinds.join(HOME_PAGE_HIDDEN_KIND_SEPARATOR)

  if (element.getAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR) !== nextHiddenKindValue)
    element.setAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR, nextHiddenKindValue)

  hideElementDisplay(element)
}

function hideElementDisplay(element: HTMLElement): void {
  if (element.style.getPropertyValue('display') === 'none' && element.style.getPropertyPriority('display') === 'important')
    return

  element.style.setProperty('display', 'none', 'important')
}

function restoreHiddenElements(root: ParentNode, kind: HomePageHiddenElementKind): void {
  Array.from(root.querySelectorAll<HTMLElement>(`[${HOME_PAGE_HIDDEN_ELEMENT_ATTR}]`))
    .filter(element => getHiddenElementKinds(element).includes(kind))
    .forEach(element => restoreHiddenElementKind(element, kind))
}

function restoreHiddenElementKind(element: HTMLElement, kind: HomePageHiddenElementKind): void {
  const hiddenKinds = getHiddenElementKinds(element)

  if (!hiddenKinds.includes(kind))
    return

  const remainingKinds = hiddenKinds.filter(hiddenKind => hiddenKind !== kind)

  if (remainingKinds.length > 0) {
    const nextHiddenKindValue = remainingKinds.join(HOME_PAGE_HIDDEN_KIND_SEPARATOR)

    if (element.getAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR) !== nextHiddenKindValue)
      element.setAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR, nextHiddenKindValue)

    hideElementDisplay(element)
    return
  }

  restoreHiddenElementDisplay(element)
  element.removeAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR)
  element.removeAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR)
  element.removeAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR)
}

function restoreHiddenElementDisplay(element: HTMLElement): void {
  const previousDisplay = element.getAttribute(HOME_PAGE_PREVIOUS_DISPLAY_ATTR) ?? ''
  const previousDisplayPriority = element.getAttribute(HOME_PAGE_PREVIOUS_DISPLAY_PRIORITY_ATTR) ?? ''

  if (previousDisplay)
    element.style.setProperty('display', previousDisplay, previousDisplayPriority)
  else
    element.style.removeProperty('display')
}

function getHiddenElementKinds(element: HTMLElement): HomePageHiddenElementKind[] {
  const rawKind = element.getAttribute(HOME_PAGE_HIDDEN_ELEMENT_ATTR)

  if (!rawKind)
    return []

  return rawKind
    .split(HOME_PAGE_HIDDEN_KIND_SEPARATOR)
    .filter(isHomePageHiddenElementKind)
}

function isHomePageHiddenElementKind(kind: string): kind is HomePageHiddenElementKind {
  return kind === 'pinned-topic' || kind === 'blocked-word'
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
