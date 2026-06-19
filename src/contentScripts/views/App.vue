<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import IframeDrawer from '~/components/IframeDrawer.vue'
import { BEWLY_MOUNTED, LINUX_DO_DRAWER_ROUTE_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import { findLinuxDoTopicLink, isLinuxDoTopicListPage, setLinuxDoDrawerHostScrollLock } from '~/sites/linuxDo'

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
    blockedWords: 'Homepage blocked words',
    blockedWordsEmpty: 'No blocked words yet.',
    blockedWordsImportInvalid: 'Import failed. Use a JSON string array.',
    blockedWordsImportSuccess: 'Blocked words imported.',
    blockedWordsPlaceholder: 'Keyword or /pattern/',
    blockedWordsRegexHint: 'Plain text uses case-insensitive includes. Use /pattern/ for regex.',
    closeSettings: 'Close settings',
    deleteBlockedWord: 'Delete blocked word',
    enableBlockedWords: 'Enable homepage blocked words',
    exportBlockedWords: 'Export',
    hidePinnedTopics: 'Hide homepage pinned topics',
    importBlockedWords: 'Import',
    openSettings: 'Open Linux.do settings',
    settings: 'Linux.do settings',
    settingsDesc: 'These options apply to the current Linux.do page.',
    showTopicTags: 'Show homepage topic tags',
  },
  'cmn-CN': {
    addBlockedWord: '添加',
    blockedWords: '首页屏蔽词',
    blockedWordsEmpty: '暂无屏蔽词。',
    blockedWordsImportInvalid: '导入失败，请使用 JSON 字符串数组。',
    blockedWordsImportSuccess: '已导入屏蔽词。',
    blockedWordsPlaceholder: '关键词或 /pattern/',
    blockedWordsRegexHint: '普通文本使用忽略大小写的包含匹配；使用 /pattern/ 可启用正则。',
    closeSettings: '关闭设置',
    deleteBlockedWord: '删除屏蔽词',
    enableBlockedWords: '启用首页屏蔽词',
    exportBlockedWords: '导出',
    hidePinnedTopics: '隐藏首页置顶话题',
    importBlockedWords: '导入',
    openSettings: '打开 Linux.do 设置',
    settings: 'Linux.do 设置',
    settingsDesc: '这些选项会应用到当前 Linux.do 页面。',
    showTopicTags: '显示首页帖子标签',
  },
  'cmn-TW': {
    addBlockedWord: '新增',
    blockedWords: '首頁屏蔽詞',
    blockedWordsEmpty: '暫無屏蔽詞。',
    blockedWordsImportInvalid: '匯入失敗，請使用 JSON 字串陣列。',
    blockedWordsImportSuccess: '已匯入屏蔽詞。',
    blockedWordsPlaceholder: '關鍵詞或 /pattern/',
    blockedWordsRegexHint: '普通文字使用忽略大小寫的包含匹配；使用 /pattern/ 可啟用正則。',
    closeSettings: '關閉設定',
    deleteBlockedWord: '刪除屏蔽詞',
    enableBlockedWords: '啟用首頁屏蔽詞',
    exportBlockedWords: '匯出',
    hidePinnedTopics: '隱藏首頁置頂話題',
    importBlockedWords: '匯入',
    openSettings: '開啟 Linux.do 設定',
    settings: 'Linux.do 設定',
    settingsDesc: '這些選項會套用到目前的 Linux.do 頁面。',
    showTopicTags: '顯示首頁話題標籤',
  },
  jyut: {
    addBlockedWord: '加入',
    blockedWords: '首頁屏蔽詞',
    blockedWordsEmpty: '暫時未有屏蔽詞。',
    blockedWordsImportInvalid: '匯入失敗，請用 JSON 字串陣列。',
    blockedWordsImportSuccess: '已匯入屏蔽詞。',
    blockedWordsPlaceholder: '關鍵詞或 /pattern/',
    blockedWordsRegexHint: '普通文字會忽略大小寫做包含匹配；用 /pattern/ 可以啟用正則。',
    closeSettings: '關閉設定',
    deleteBlockedWord: '刪除屏蔽詞',
    enableBlockedWords: '啟用首頁屏蔽詞',
    exportBlockedWords: '匯出',
    hidePinnedTopics: '收埋首頁置頂話題',
    importBlockedWords: '匯入',
    openSettings: '打開 Linux.do 設定',
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

  updateHomePageBlockedWords([...settings.value.homePageBlockedWords, blockedWord])
  blockedWordInput.value = ''
  blockedWordsStatusMessage.value = ''
}

function deleteBlockedWord(index: number) {
  updateHomePageBlockedWords(
    settings.value.homePageBlockedWords.filter((_, currentIndex) => currentIndex !== index),
  )
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

    updateHomePageBlockedWords(importedWords)
    blockedWordsStatusMessage.value = appLabels.blockedWordsImportSuccess
  }
  catch {
    blockedWordsStatusMessage.value = appLabels.blockedWordsImportInvalid
  }
}

function handleBlockedWordsExport() {
  const blockedWords = settings.value.homePageBlockedWords

  if (blockedWords.length === 0)
    return

  const blob = new Blob([JSON.stringify(blockedWords, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'linux-do-homepage-blocked-words.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function updateHomePageBlockedWords(words: string[]) {
  settings.value = {
    ...settings.value,
    homePageBlockedWords: dedupeBlockedWords(words.map(normalizeBlockedWord).filter(Boolean)),
  }
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

useEventListener(document, 'click', handleDocumentClick, { capture: true })
useEventListener(window, 'popstate', handlePopState)

watch(showIframeDrawer, open => setLinuxDoDrawerHostScrollLock(open, document))

onMounted(() => {
  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))
})

onBeforeUnmount(() => {
  setLinuxDoDrawerHostScrollLock(false, document)
  dispatchDrawerRouteChange({ isOpen: false })
})
</script>

<template>
  <div class="linux-do-extension-root">
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
        <input v-model="settings.enableHomePageBlockedWords" type="checkbox">
        <span>{{ appLabels.enableBlockedWords }}</span>
      </label>

      <div class="linux-do-settings-blocklist" role="group" :aria-label="appLabels.blockedWords">
        <p class="linux-do-settings-blocklist-title">
          {{ appLabels.blockedWords }}
        </p>

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
            :disabled="settings.homePageBlockedWords.length === 0"
            @click="handleBlockedWordsExport"
          >
            {{ appLabels.exportBlockedWords }}
          </button>
        </div>

        <ul v-if="settings.homePageBlockedWords.length > 0" class="linux-do-settings-blocked-words-list">
          <li v-for="(word, index) in settings.homePageBlockedWords" :key="`${word}-${index}`">
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
    </section>

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

.linux-do-settings-blocklist {
  padding-top: 12px;
  border-top: 1px solid var(--bew-border-color);
}

.linux-do-settings-blocklist-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
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
