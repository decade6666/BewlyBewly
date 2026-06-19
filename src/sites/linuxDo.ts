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
const TOPIC_CATEGORY_CLASS_PATTERN = /^category-(.+)$/
const NATIVE_TOPIC_TAG_LINK_SELECTOR = '.discourse-tags a[href], a.discourse-tag[href]'
const INJECTED_TAG_CONTAINER_ATTR = 'data-bewly-topic-tags'
const INJECTED_TAG_MARKER_ATTR = 'data-bewly-topic-tag'
const CATEGORY_LINK_SELECTOR = 'a[href^="/c/"]'
const TOPIC_TITLE_BOTTOM_LINE_SELECTOR = '.link-bottom-line'
const TOPIC_CATEGORY_CELL_SELECTOR = 'td.topic-category-data'
// Drawer reading view: hide Linux.do's own header and left sidebar inside
// the same-origin drawer iframe. The host content script injects this style
// into the iframe document because the content script itself never runs inside
// sub-frames.
const DRAWER_HIDDEN_CHROME_STYLE_ID = 'bewly-drawer-hidden-chrome'
const DRAWER_HIDDEN_CHROME_CSS = `
html,
body {
  background: var(--secondary, #fff) !important;
}

.sidebar-wrapper,
.d-header {
  display: none !important;
}

#main-outlet-wrapper {
  grid-template-columns: 0 minmax(0, 1fr) !important;
}

#main-outlet {
  grid-column: 1 / -1 !important;
}
`

interface TopicTag {
  name: string
  href: string
}

type HomePageHiddenElementKind = 'pinned-topic' | 'blocked-word'
type HomePageBlockedWordMatcher = (text: string) => boolean

export function applyLinuxDoDrawerChrome(doc: Document | null | undefined): void {
  if (!doc || doc.getElementById(DRAWER_HIDDEN_CHROME_STYLE_ID))
    return

  const mountPoint = doc.head ?? doc.documentElement

  if (!mountPoint)
    return

  const style = doc.createElement('style')

  style.id = DRAWER_HIDDEN_CHROME_STYLE_ID
  style.textContent = DRAWER_HIDDEN_CHROME_CSS
  mountPoint.appendChild(style)
}

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
  const desiredTags = getTopicTags(element)
  const existingContainer = element.querySelector<HTMLElement>(`[${INJECTED_TAG_CONTAINER_ATTR}]`)
  const currentTags = existingContainer ? getInjectedTags(existingContainer) : []
  const anchor = resolveTagInsertionAnchor(element)
  const tagsUnchanged = areTopicTagListsEqual(desiredTags, currentTags)
  const placementUnchanged = !existingContainer || (anchor !== null && isTagContainerAtAnchor(existingContainer, anchor))

  if (tagsUnchanged && placementUnchanged)
    return

  if (existingContainer)
    existingContainer.remove()

  if (desiredTags.length === 0 || !anchor)
    return

  const container = buildTopicTagContainer(element.ownerDocument, desiredTags)
  anchor.parent.insertBefore(container, anchor.refNode)
}

function getTopicTags(element: HTMLElement): TopicTag[] {
  const nativeTags = getNativeTopicTags(element)
  const fallbackTags = getFallbackTopicTags(element)

  if (nativeTags.length === 0)
    return fallbackTags

  const nativeTagNames = new Set(nativeTags.map(tag => normalizeTagIdentity(tag.name)))
  const missingFallbackTags = fallbackTags.filter(tag => !nativeTagNames.has(normalizeTagIdentity(tag.name)))

  return [...nativeTags, ...missingFallbackTags]
}

function getNativeTopicTags(element: HTMLElement): TopicTag[] {
  return Array.from(element.querySelectorAll<HTMLAnchorElement>(NATIVE_TOPIC_TAG_LINK_SELECTOR))
    .filter(link => !link.hasAttribute(INJECTED_TAG_MARKER_ATTR) && !link.closest(`[${INJECTED_TAG_CONTAINER_ATTR}]`))
    .map(toNativeTopicTag)
    .filter((tag): tag is TopicTag => tag !== null)
}

function toNativeTopicTag(link: HTMLAnchorElement): TopicTag | null {
  const name = (link.getAttribute('data-tag-name') ?? link.textContent ?? '').trim()

  if (!name)
    return null

  return {
    name,
    href: link.getAttribute('href') ?? createTopicTagHref(name),
  }
}

function getFallbackTopicTags(element: HTMLElement): TopicTag[] {
  const categorySlugs = new Set(getTopicCategorySlugs(element).map(normalizeTagIdentity))

  return Array.from(element.classList)
    .map(token => TOPIC_TAG_CLASS_PATTERN.exec(token)?.[1])
    .filter((name): name is string => Boolean(name))
    .filter(name => !categorySlugs.has(normalizeTagIdentity(name)))
    .map(name => ({ name, href: createTopicTagHref(name) }))
}

function getTopicCategorySlugs(element: HTMLElement): string[] {
  return Array.from(element.classList)
    .map(token => TOPIC_CATEGORY_CLASS_PATTERN.exec(token)?.[1])
    .filter((name): name is string => Boolean(name))
}

function createTopicTagHref(name: string): string {
  return `/tag/${encodeURIComponent(name)}`
}

function normalizeTagIdentity(value: string): string {
  return value.trim().toLowerCase()
}

function getInjectedTags(container: HTMLElement): TopicTag[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>(`[${INJECTED_TAG_MARKER_ATTR}]`))
    .map(link => ({
      name: link.textContent ?? '',
      href: link.getAttribute('href') ?? '',
    }))
}

function areTopicTagListsEqual(left: TopicTag[], right: TopicTag[]): boolean {
  return left.length === right.length
    && left.every((value, index) => {
      const rightValue = right[index]

      return value.name === rightValue.name && value.href === rightValue.href
    })
}

function isElementVisibleWithin(node: Element, boundary: Element): boolean {
  let current: Element | null = node

  while (current && current !== boundary) {
    if (current.ownerDocument.defaultView?.getComputedStyle(current).display === 'none')
      return false

    current = current.parentElement
  }

  return true
}

function getTagInsertionRefNode(node: ChildNode | null): ChildNode | null {
  if (!(node instanceof HTMLElement) || !node.hasAttribute(INJECTED_TAG_CONTAINER_ATTR))
    return node

  return node.nextSibling
}

function isTagContainerAtAnchor(container: HTMLElement, anchor: { parent: Element, refNode: Node | null }): boolean {
  return container.parentElement === anchor.parent && container.nextSibling === anchor.refNode
}

function resolveTagInsertionAnchor(element: HTMLElement): { parent: Element, refNode: Node | null } | null {
  const categoryAnchors = Array.from(element.querySelectorAll<HTMLAnchorElement>(CATEGORY_LINK_SELECTOR))
  const visibleAnchor = categoryAnchors.find(anchor => isElementVisibleWithin(anchor, element))

  if (visibleAnchor?.parentElement)
    return { parent: visibleAnchor.parentElement, refNode: getTagInsertionRefNode(visibleAnchor.nextSibling) }

  const categoryCell = element.querySelector<HTMLElement>(TOPIC_CATEGORY_CELL_SELECTOR)

  if (categoryCell)
    return { parent: categoryCell, refNode: null }

  const bottomLine = element.querySelector<HTMLElement>(TOPIC_TITLE_BOTTOM_LINE_SELECTOR)

  if (bottomLine)
    return { parent: bottomLine, refNode: null }

  return null
}

function buildTopicTagContainer(doc: Document, tags: TopicTag[]): HTMLElement {
  const container = doc.createElement('span')

  container.className = 'discourse-tags bewly-injected-tags'
  container.setAttribute(INJECTED_TAG_CONTAINER_ATTR, '')

  // 复用站点类名 discourse-tags 会继承 Horizon 主题的 `.discourse-tags { display: contents }`，
  // 该规则会让本容器 span 自身从布局树中消失，其内部多个 <a> 直接成为父级 flex 项
  // （td.topic-category-data 在 Horizon 下为 display: flex），导致标签竖排/被挤压/把行撑高。
  // 这里用内联样式（important）强制容器自身成为一个整体横向布局盒子，覆盖站点类选择器，
  // 且不影响 default/MOYU（父容器非 flex，inline-flex 表现同样正常）。
  // flex-wrap 用 nowrap：Horizon 把 td.topic-category-data 放进一个内容自适应的 grid 轨道，
  // 若容器允许换行，其 min-content 只等于最宽的单个标签，轨道宽度被压到一个标签的尺寸，
  // 徽章 + 多个标签便在窄列内逐个竖排换行；nowrap 让容器 min-content 等于全部标签宽度之和，
  // grid 轨道随之自动撑宽，徽章 + 标签回到同一横排（多余宽度由超宽的活动列吸收，不与右侧列重叠）。
  container.style.setProperty('display', 'inline-flex', 'important')
  container.style.setProperty('flex-wrap', 'nowrap')
  container.style.setProperty('align-items', 'center')
  container.style.setProperty('gap', '0.25em')

  tags.forEach((tag) => {
    const link = doc.createElement('a')

    link.className = 'discourse-tag box'
    link.setAttribute(INJECTED_TAG_MARKER_ATTR, '')
    link.setAttribute('href', tag.href)
    link.textContent = tag.name
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
