<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import IframeDrawer from '~/components/IframeDrawer.vue'
import { BEWLY_MOUNTED, LINUX_DO_DRAWER_ROUTE_CHANGE } from '~/constants/globalEvents'
import { resolveScrollAction } from '~/contentScripts/scrollAction'
import { BLOCKED_WORDS_MAX_BYTES, blockedWords, settings } from '~/logic'
import { detectLinuxDoColorScheme, findLinuxDoTopicLink, isLinuxDoTopicListPage, refreshLinuxDoTopicListInPlace, setLinuxDoDrawerHostScrollLock } from '~/sites/linuxDo'

const DRAWER_HISTORY_STATE_KEY = '__bewlyLinuxDoDrawer'

interface DrawerHistoryState {
  [DRAWER_HISTORY_STATE_KEY]: true
  drawerUrl: string
  baseUrl: string
}

interface LinuxDoDrawerRouteChangeDetail {
  isOpen: boolean
  baseUrl?: string
}

const appMessages = {
  en: {
    addBlockedWord: 'Add',
    backToTop: 'Back to top',
    blockedWords: 'Homepage blocked words',
    blockedWordsEmpty: 'No blocked words yet.',
    blockedWordsImportInvalid: 'Import failed. Use a JSON string array.',
    blockedWordsImportSuccess: 'Blocked words imported.',
    blockedWordsPlaceholder: 'Keyword or /pattern/',
    blockedWordsQuotaExceeded: 'Blocked words list is too large to sync. Remove some entries.',
    blockedWordsRegexHint: 'Plain text uses case-insensitive includes. Use /pattern/ for regex.',
    blockedWordsSettings: 'Blocked words settings',
    closeBlockedWords: 'Close blocked words settings',
    closeSettings: 'Close settings',
    deleteBlockedWord: 'Delete blocked word',
    enableBlockedWords: 'Enable homepage blocked words',
    exportBlockedWords: 'Export',
    hidePinnedTopics: 'Hide homepage pinned topics',
    importBlockedWords: 'Import',
    openSettings: 'Open Linux.do settings',
    refreshPage: 'Refresh page',
    settings: 'Linux.do settings',
    settingsDesc: 'These options apply to the current Linux.do page.',
    showTopicTags: 'Show homepage topic tags',
  },
  'cmn-CN': {
    addBlockedWord: '添加',
    backToTop: '返回顶部',
    blockedWords: '首页屏蔽词',
    blockedWordsEmpty: '暂无屏蔽词。',
    blockedWordsImportInvalid: '导入失败，请使用 JSON 字符串数组。',
    blockedWordsImportSuccess: '已导入屏蔽词。',
    blockedWordsPlaceholder: '关键词或 /pattern/',
    blockedWordsQuotaExceeded: '屏蔽词列表过大，无法同步。请删除部分词条。',
    blockedWordsRegexHint: '普通文本使用忽略大小写的包含匹配；使用 /pattern/ 可启用正则。',
    blockedWordsSettings: '屏蔽词设置',
    closeBlockedWords: '关闭屏蔽词设置',
    closeSettings: '关闭设置',
    deleteBlockedWord: '删除屏蔽词',
    enableBlockedWords: '启用首页屏蔽词',
    exportBlockedWords: '导出',
    hidePinnedTopics: '隐藏首页置顶话题',
    importBlockedWords: '导入',
    openSettings: '打开 Linux.do 设置',
    refreshPage: '刷新页面',
    settings: 'Linux.do 设置',
    settingsDesc: '这些选项会应用到当前 Linux.do 页面。',
    showTopicTags: '显示首页帖子标签',
  },
  'cmn-TW': {
    addBlockedWord: '新增',
    backToTop: '返回頂部',
    blockedWords: '首頁屏蔽詞',
    blockedWordsEmpty: '暫無屏蔽詞。',
    blockedWordsImportInvalid: '匯入失敗，請使用 JSON 字串陣列。',
    blockedWordsImportSuccess: '已匯入屏蔽詞。',
    blockedWordsPlaceholder: '關鍵詞或 /pattern/',
    blockedWordsQuotaExceeded: '屏蔽詞清單過大，無法同步。請刪除部分詞條。',
    blockedWordsRegexHint: '普通文字使用忽略大小寫的包含匹配；使用 /pattern/ 可啟用正則。',
    blockedWordsSettings: '屏蔽詞設定',
    closeBlockedWords: '關閉屏蔽詞設定',
    closeSettings: '關閉設定',
    deleteBlockedWord: '刪除屏蔽詞',
    enableBlockedWords: '啟用首頁屏蔽詞',
    exportBlockedWords: '匯出',
    hidePinnedTopics: '隱藏首頁置頂話題',
    importBlockedWords: '匯入',
    openSettings: '開啟 Linux.do 設定',
    refreshPage: '重新整理頁面',
    settings: 'Linux.do 設定',
    settingsDesc: '這些選項會套用到目前的 Linux.do 頁面。',
    showTopicTags: '顯示首頁話題標籤',
  },
  jyut: {
    addBlockedWord: '加入',
    backToTop: '返去頂部',
    blockedWords: '首頁屏蔽詞',
    blockedWordsEmpty: '暫時未有屏蔽詞。',
    blockedWordsImportInvalid: '匯入失敗，請用 JSON 字串陣列。',
    blockedWordsImportSuccess: '已匯入屏蔽詞。',
    blockedWordsPlaceholder: '關鍵詞或 /pattern/',
    blockedWordsQuotaExceeded: '屏蔽詞清單太大，同步唔到。請刪走部分詞條。',
    blockedWordsRegexHint: '普通文字會忽略大小寫做包含匹配；用 /pattern/ 可以啟用正則。',
    blockedWordsSettings: '屏蔽詞設定',
    closeBlockedWords: '閂屏蔽詞設定',
    closeSettings: '關閉設定',
    deleteBlockedWord: '刪除屏蔽詞',
    enableBlockedWords: '啟用首頁屏蔽詞',
    exportBlockedWords: '匯出',
    hidePinnedTopics: '收埋首頁置頂話題',
    importBlockedWords: '匯入',
    openSettings: '打開 Linux.do 設定',
    refreshPage: '重新整理頁面',
    settings: 'Linux.do 設定',
    settingsDesc: '呢啲選項會套用喺而家嘅 Linux.do 頁面。',
    showTopicTags: '顯示首頁話題標籤',
  },
} as const

type AppLocale = keyof typeof appMessages

const appLabels = appMessages[getAppLocale(navigator.language)]
const iframeDrawerURL = ref<string>('')
const drawerBaseURL = ref<string>('')
const showIframeDrawer = ref<boolean>(false)
const showSettingsPanel = ref<boolean>(false)
const blockedWordInput = ref<string>('')
const blockedWordsStatusMessage = ref<string>('')
const blockedWordsImportInput = ref<HTMLInputElement | null>(null)
const showBlockedWordsDialog = ref<boolean>(false)
const isPageAtTop = ref<boolean>(true)
const isHostDark = ref(false)
let hostSchemeObserver: MutationObserver | null = null
let hostSchemeMediaQuery: MediaQueryList | null = null
let hostSchemeMediaHandler: (() => void) | null = null

function updateHostDarkScheme() {
  isHostDark.value = detectLinuxDoColorScheme(document) === 'dark'
}

function updatePageScrollState() {
  isPageAtTop.value = window.scrollY <= 10
}

function handleScrollActionClick() {
  const listRefreshTriggered
    = isPageAtTop.value
    && isLinuxDoTopicListPage(location.href)
    && refreshLinuxDoTopicListInPlace()

  switch (resolveScrollAction(isPageAtTop.value, listRefreshTriggered)) {
    case 'refresh-list-scroll-top':
      window.scrollTo({ top: 0 })
      break
    case 'reload':
      window.location.reload()
      break
    case 'smooth-scroll-top':
      window.scrollTo({ top: 0, behavior: 'smooth' })
      break
  }
}

function getAppLocale(language: string): AppLocale {
  const normalizedLanguage = language.toLowerCase()

  if (normalizedLanguage.startsWith('zh-hk') || normalizedLanguage.startsWith('yue'))
    return 'jyut'

  if (normalizedLanguage.startsWith('zh-tw'))
    return 'cmn-TW'

  if (normalizedLanguage.startsWith('zh'))
    return 'cmn-CN'

  return 'en'
}

function addBlockedWord() {
  const blockedWord = normalizeBlockedWord(blockedWordInput.value)

  if (!blockedWord)
    return

  if (!updateHomePageBlockedWords([...blockedWords.value.words, blockedWord]))
    return

  blockedWordInput.value = ''
  blockedWordsStatusMessage.value = ''
}

function deleteBlockedWord(index: number) {
  if (!updateHomePageBlockedWords(
    blockedWords.value.words.filter((_, currentIndex) => currentIndex !== index),
  )) {
    return
  }

  blockedWordsStatusMessage.value = ''
}

function handleBlockedWordsImportClick() {
  blockedWordsImportInput.value?.click()
}

async function handleBlockedWordsImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file)
    return

  try {
    const parsedFileContent = JSON.parse(await file.text()) as unknown
    const importedWords = parseImportedBlockedWords(parsedFileContent)

    if (!importedWords)
      throw new Error('Invalid blocked words import format')

    if (!updateHomePageBlockedWords(importedWords))
      return

    blockedWordsStatusMessage.value = appLabels.blockedWordsImportSuccess
  }
  catch {
    blockedWordsStatusMessage.value = appLabels.blockedWordsImportInvalid
  }
}

function handleBlockedWordsExport() {
  const exportedWords = blockedWords.value.words

  if (exportedWords.length === 0)
    return

  const blob = new Blob([JSON.stringify(exportedWords, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'linux-do-homepage-blocked-words.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function updateHomePageBlockedWords(words: string[]): boolean {
  const candidate = dedupeBlockedWords(words.map(normalizeBlockedWord).filter(Boolean))
  const candidateBytes = new TextEncoder().encode(JSON.stringify({
    enabled: blockedWords.value.enabled,
    words: candidate,
  })).length

  if (candidateBytes > BLOCKED_WORDS_MAX_BYTES) {
    blockedWordsStatusMessage.value = appLabels.blockedWordsQuotaExceeded
    return false
  }

  blockedWords.value = {
    ...blockedWords.value,
    words: candidate,
  }
  return true
}

function parseImportedBlockedWords(value: unknown): string[] | null {
  if (!Array.isArray(value))
    return null

  const importedWords = value.map(getImportedBlockedWord)

  if (importedWords.includes(null))
    return null

  const validImportedWords = importedWords.filter((word): word is string => typeof word === 'string' && word !== '')

  return dedupeBlockedWords(validImportedWords)
}

function getImportedBlockedWord(value: unknown): string | null {
  if (typeof value === 'string')
    return normalizeBlockedWord(value)

  if (!value || typeof value !== 'object' || !('keyword' in value))
    return null

  const keyword = (value as { keyword?: unknown }).keyword

  return typeof keyword === 'string' ? normalizeBlockedWord(keyword) : null
}

function normalizeBlockedWord(value: string): string {
  return value.trim()
}

function dedupeBlockedWords(words: string[]): string[] {
  return words.reduce<string[]>((result, word) => {
    const normalizedResult = result.map(existingWord => existingWord.toLowerCase())
    const normalizedWord = word.toLowerCase()

    return normalizedResult.includes(normalizedWord) ? result : [...result, word]
  }, [])
}

function shouldIgnoreClick(event: MouseEvent): boolean {
  return event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
}

function getClickTarget(event: MouseEvent): EventTarget | null {
  // Shadow DOM retargets event.target to the shadow host for listeners
  // outside the shadow tree. Use composedPath() to get the actual element
  // that was clicked inside the shadow DOM.
  const path = event.composedPath()

  return path.length > 0 ? path[0] : event.target
}

function handleDocumentClick(event: MouseEvent) {
  if (shouldIgnoreClick(event) || !isLinuxDoTopicListPage(location.href))
    return

  const topicUrl = findLinuxDoTopicLink(getClickTarget(event), location.href)

  if (!topicUrl)
    return

  event.preventDefault()
  event.stopPropagation()
  openIframeDrawer(topicUrl)
}

function openIframeDrawer(topicUrl: string, baseUrl: string = location.href, updateHistory = true) {
  drawerBaseURL.value = baseUrl
  iframeDrawerURL.value = topicUrl
  showIframeDrawer.value = true
  dispatchDrawerRouteChange({ isOpen: true, baseUrl })

  if (updateHistory)
    history.pushState(createDrawerHistoryState(topicUrl, baseUrl), '', topicUrl)
}

function handleDrawerClose() {
  closeDrawerWithoutHistoryNavigation()
}

function handlePopState(event: PopStateEvent) {
  const drawerState = getDrawerHistoryState(event.state)

  if (drawerState) {
    openIframeDrawer(drawerState.drawerUrl, drawerState.baseUrl, false)
    return
  }

  if (showIframeDrawer.value)
    hideIframeDrawer()
}

function closeDrawerWithoutHistoryNavigation() {
  const baseUrl = drawerBaseURL.value
  hideIframeDrawer()

  if (baseUrl && location.href !== baseUrl)
    history.replaceState(history.state, '', baseUrl)
}

function hideIframeDrawer() {
  showIframeDrawer.value = false
  iframeDrawerURL.value = ''
  drawerBaseURL.value = ''
  dispatchDrawerRouteChange({ isOpen: false })
}

function createDrawerHistoryState(topicUrl: string, baseUrl: string): DrawerHistoryState {
  return {
    [DRAWER_HISTORY_STATE_KEY]: true,
    drawerUrl: topicUrl,
    baseUrl,
  }
}

function getDrawerHistoryState(state: unknown): DrawerHistoryState | null {
  if (!state || typeof state !== 'object')
    return null

  const candidate = state as Partial<DrawerHistoryState>

  if (candidate[DRAWER_HISTORY_STATE_KEY] !== true)
    return null

  if (typeof candidate.drawerUrl !== 'string' || typeof candidate.baseUrl !== 'string')
    return null

  return candidate as DrawerHistoryState
}

function dispatchDrawerRouteChange(detail: LinuxDoDrawerRouteChangeDetail) {
  window.dispatchEvent(new CustomEvent(LINUX_DO_DRAWER_ROUTE_CHANGE, { detail }))
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showBlockedWordsDialog.value)
    showBlockedWordsDialog.value = false
}

useEventListener(document, 'click', handleDocumentClick, { capture: true })
useEventListener(window, 'popstate', handlePopState)
useEventListener(document, 'keydown', handleGlobalKeydown)
useEventListener(window, 'scroll', updatePageScrollState, { passive: true })

watch(showIframeDrawer, open => setLinuxDoDrawerHostScrollLock(open, document))

onMounted(() => {
  updatePageScrollState()
  updateHostDarkScheme()

  hostSchemeObserver = new MutationObserver(() => {
    requestAnimationFrame(updateHostDarkScheme)
  })
  hostSchemeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'data-theme-name', 'data-theme-id'],
  })

  hostSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  hostSchemeMediaHandler = () => requestAnimationFrame(updateHostDarkScheme)
  hostSchemeMediaQuery.addEventListener('change', hostSchemeMediaHandler)

  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))
})

onBeforeUnmount(() => {
  hostSchemeObserver?.disconnect()
  hostSchemeObserver = null
  if (hostSchemeMediaQuery && hostSchemeMediaHandler)
    hostSchemeMediaQuery.removeEventListener('change', hostSchemeMediaHandler)
  hostSchemeMediaQuery = null
  hostSchemeMediaHandler = null

  setLinuxDoDrawerHostScrollLock(false, document)
  dispatchDrawerRouteChange({ isOpen: false })
})
</script>

<template>
  <div class="linux-do-extension-root" :class="{ dark: isHostDark }">
    <button
      v-if="!showSettingsPanel"
      class="linux-do-scroll-action-button"
      type="button"
      :aria-label="isPageAtTop ? appLabels.refreshPage : appLabels.backToTop"
      @click="handleScrollActionClick"
    >
      <span
        :class="isPageAtTop ? 'i-mingcute:refresh-2-line' : 'i-mingcute:arrow-up-line'"
        aria-hidden="true"
      />
    </button>

    <button
      class="linux-do-settings-button"
      type="button"
      :aria-label="appLabels.openSettings"
      :aria-expanded="showSettingsPanel"
      @click="showSettingsPanel = !showSettingsPanel"
    >
      <span i-mingcute:settings-3-line aria-hidden="true" />
    </button>

    <section
      v-if="showSettingsPanel"
      class="linux-do-settings-panel"
      role="dialog"
      :aria-label="appLabels.settings"
    >
      <header class="linux-do-settings-panel-header">
        <div>
          <h2>{{ appLabels.settings }}</h2>
          <p>{{ appLabels.settingsDesc }}</p>
        </div>
        <button
          class="linux-do-settings-panel-close"
          type="button"
          :aria-label="appLabels.closeSettings"
          @click="showSettingsPanel = false"
        >
          <span i-mingcute:close-line aria-hidden="true" />
        </button>
      </header>

      <label class="linux-do-settings-option">
        <input v-model="settings.hideHomePagePinnedTopics" type="checkbox">
        <span>{{ appLabels.hidePinnedTopics }}</span>
      </label>

      <label class="linux-do-settings-option">
        <input v-model="settings.showHomePageTopicTags" type="checkbox">
        <span>{{ appLabels.showTopicTags }}</span>
      </label>

      <label class="linux-do-settings-option">
        <input v-model="blockedWords.enabled" type="checkbox">
        <span>{{ appLabels.enableBlockedWords }}</span>
      </label>

      <button
        class="linux-do-settings-secondary-button linux-do-settings-blocked-words-trigger"
        type="button"
        @click="showBlockedWordsDialog = true"
      >
        {{ appLabels.blockedWordsSettings }}
      </button>
    </section>

    <div
      v-if="showBlockedWordsDialog"
      class="linux-do-blocked-words-overlay"
      @click.self="showBlockedWordsDialog = false"
    >
      <div
        class="linux-do-blocked-words-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="appLabels.blockedWords"
      >
        <header class="linux-do-blocked-words-modal-header">
          <h2>{{ appLabels.blockedWords }}</h2>
          <button
            class="linux-do-settings-panel-close"
            type="button"
            :aria-label="appLabels.closeBlockedWords"
            @click="showBlockedWordsDialog = false"
          >
            <span i-mingcute:close-line aria-hidden="true" />
          </button>
        </header>

        <div class="linux-do-blocked-words-modal-body" role="group" :aria-label="appLabels.blockedWords">
          <div class="linux-do-settings-blocklist-input-row">
            <input
              v-model="blockedWordInput"
              class="linux-do-settings-blocklist-input"
              type="text"
              :aria-label="appLabels.blockedWords"
              :placeholder="appLabels.blockedWordsPlaceholder"
              @keydown.enter.prevent="addBlockedWord"
            >
            <button
              class="linux-do-settings-secondary-button"
              type="button"
              @click="addBlockedWord"
            >
              {{ appLabels.addBlockedWord }}
            </button>
          </div>

          <p class="linux-do-settings-hint">
            {{ appLabels.blockedWordsRegexHint }}
          </p>

          <div class="linux-do-settings-blocklist-actions">
            <input
              ref="blockedWordsImportInput"
              type="file"
              accept=".json,application/json"
              hidden
              @change="handleBlockedWordsImport"
            >
            <button
              class="linux-do-settings-secondary-button"
              type="button"
              @click="handleBlockedWordsImportClick"
            >
              {{ appLabels.importBlockedWords }}
            </button>
            <button
              class="linux-do-settings-secondary-button"
              type="button"
              :disabled="blockedWords.words.length === 0"
              @click="handleBlockedWordsExport"
            >
              {{ appLabels.exportBlockedWords }}
            </button>
          </div>

          <ul v-if="blockedWords.words.length > 0" class="linux-do-settings-blocked-words-list">
            <li v-for="(word, index) in blockedWords.words" :key="`${word}-${index}`">
              <span>{{ word }}</span>
              <button
                class="linux-do-settings-icon-button"
                type="button"
                :aria-label="`${appLabels.deleteBlockedWord}: ${word}`"
                @click="deleteBlockedWord(index)"
              >
                <span i-mingcute:close-line aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="linux-do-settings-empty">
            {{ appLabels.blockedWordsEmpty }}
          </p>

          <p v-if="blockedWordsStatusMessage" class="linux-do-settings-status" role="status" aria-live="polite">
            {{ blockedWordsStatusMessage }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="showIframeDrawer" id="bewly-wrapper" class="linux-do-drawer-root">
      <div class="linux-do-drawer">
        <IframeDrawer
          :url="iframeDrawerURL"
          @close="handleDrawerClose"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.linux-do-extension-root {
  --bew-bg: hsl(0deg 0% 100%);
  --bew-border-color: hsl(220deg 13% 91%);
  --bew-content-solid: hsl(220deg 14% 96%);
  --bew-content-solid-hover: hsl(220deg 13% 91%);
  --bew-elevated-solid: hsl(0deg 0% 100%);
  --bew-elevated-solid-hover: hsl(220deg 14% 96%);
  --bew-error-color: hsl(0deg 72% 51%);
  --bew-fill-1: hsl(220deg 14% 96%);
  --bew-fill-2: hsl(220deg 13% 91%);
  --bew-page-max-width: min(1200px, 100vw);
  --bew-radius: 12px;
  --bew-text-1: hsl(222deg 47% 11%);
  --bew-text-2: hsl(220deg 9% 46%);
  --bew-theme-color: hsl(210deg 100% 50%);
  --bew-top-bar-height: 56px;

  color: var(--bew-text-1);
  font-family: Inter, Roboto, "Noto Sans", sans-serif;
  line-height: 1.4;
}

.linux-do-extension-root.dark {
  --bew-bg: hsl(230deg 12% 4%);
  --bew-content-solid: hsl(230deg 12% 10%);
  --bew-content-solid-hover: hsl(230deg 12% 25%);
  --bew-elevated-solid: hsl(230deg 12% 15%);
  --bew-elevated-solid-hover: hsl(230deg 12% 30%);
  --bew-fill-1: rgb(131 131 145 / 15%);
  --bew-fill-2: rgb(131 131 145 / 30%);
  --bew-border-color: rgb(131 131 145 / 18%);
  --bew-text-1: hsl(215deg 19% 98%);
  --bew-text-2: hsl(215deg 19% 90% / 80%);
}

.linux-do-settings-button {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  box-shadow: 0 12px 30px hsl(220deg 40% 2% / 18%);
  cursor: pointer;
  pointer-events: auto;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover,
  &:focus-visible {
    color: white;
    background: var(--bew-theme-color);
    transform: translateY(-2px);
    outline: none;
  }

  span {
    width: 22px;
    height: 22px;
  }
}

.linux-do-scroll-action-button {
  position: fixed;
  right: 18px;
  bottom: 76px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  box-shadow: 0 12px 30px hsl(220deg 40% 2% / 18%);
  cursor: pointer;
  pointer-events: auto;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover,
  &:focus-visible {
    color: white;
    background: var(--bew-theme-color);
    transform: translateY(-2px);
    outline: none;
  }

  span {
    width: 22px;
    height: 22px;
  }
}

.linux-do-settings-panel {
  position: fixed;
  right: 18px;
  bottom: 76px;
  z-index: 2147483646;
  box-sizing: border-box;
  width: min(380px, calc(100vw - 36px));
  padding: 16px;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: 0 18px 45px hsl(220deg 40% 2% / 18%);
  pointer-events: auto;
}

.linux-do-blocked-words-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgb(0 0 0 / 45%);
  pointer-events: auto;
}

.linux-do-blocked-words-modal {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(92vw, 640px);
  max-height: 80vh;
  padding: 20px;
  overflow: auto;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: 0 24px 60px hsl(220deg 40% 2% / 28%);
}

.linux-do-blocked-words-modal-header {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
}

.linux-do-blocked-words-modal-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.linux-do-settings-panel-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin-top: 4px;
    color: var(--bew-text-2);
    font-size: 13px;
  }
}

.linux-do-settings-panel-close {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--bew-theme-color);
    background: var(--bew-fill-2);
    outline: none;
  }
}

.linux-do-settings-option {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
  cursor: pointer;

  & + & {
    border-top: 1px solid var(--bew-border-color);
  }

  input {
    width: 16px;
    height: 16px;
    accent-color: var(--bew-theme-color);
  }
}

.linux-do-settings-blocked-words-trigger {
  width: 100%;
  margin-top: 12px;
}

.linux-do-settings-blocklist-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.linux-do-settings-blocklist-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;

  &:focus-visible {
    border-color: var(--bew-theme-color);
    outline: none;
  }
}

.linux-do-settings-secondary-button {
  min-height: 34px;
  padding: 0 10px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: var(--bew-theme-color);
    background: var(--bew-fill-2);
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.linux-do-settings-hint,
.linux-do-settings-empty,
.linux-do-settings-status {
  margin: 8px 0 0;
  color: var(--bew-text-2);
  font-size: 12px;
}

.linux-do-settings-status {
  color: var(--bew-theme-color);
}

.linux-do-settings-blocklist-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.linux-do-settings-blocked-words-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 140px;
  padding: 0;
  margin: 10px 0 0;
  overflow: auto;
  list-style: none;

  li {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: var(--bew-fill-1);
    border-radius: 8px;
  }

  li > span:first-child {
    overflow-wrap: anywhere;
  }
}

.linux-do-settings-icon-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--bew-text-2);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--bew-error-color);
    background: var(--bew-fill-2);
    outline: none;
  }

  span {
    width: 16px;
    height: 16px;
  }
}

.linux-do-drawer-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  color: var(--bew-text-1);
  pointer-events: none;
}

.linux-do-drawer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
</style>
