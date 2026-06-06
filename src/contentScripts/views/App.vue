<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import IframeDrawer from '~/components/IframeDrawer.vue'
import { BEWLY_MOUNTED, LINUX_DO_DRAWER_ROUTE_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import { findLinuxDoTopicLink, isLinuxDoTopicListPage } from '~/sites/linuxDo'

const DRAWER_HISTORY_STATE_KEY = '__bewlyLinuxDoDrawer'
const DRAWER_HISTORY_CLOSE_FALLBACK_MS = 150

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
    closeSettings: 'Close settings',
    hideGuidelineBanner: 'Hide homepage guideline banner',
    hidePinnedTopics: 'Hide homepage pinned topics',
    openSettings: 'Open Linux.do settings',
    settings: 'Linux.do settings',
    settingsDesc: 'These options apply to the current Linux.do page.',
  },
  'cmn-CN': {
    closeSettings: '关闭设置',
    hideGuidelineBanner: '隐藏首页社区准则横幅',
    hidePinnedTopics: '隐藏首页置顶话题',
    openSettings: '打开 Linux.do 设置',
    settings: 'Linux.do 设置',
    settingsDesc: '这些选项会应用到当前 Linux.do 页面。',
  },
  'cmn-TW': {
    closeSettings: '關閉設定',
    hideGuidelineBanner: '隱藏首頁社群準則橫幅',
    hidePinnedTopics: '隱藏首頁置頂話題',
    openSettings: '開啟 Linux.do 設定',
    settings: 'Linux.do 設定',
    settingsDesc: '這些選項會套用到目前的 Linux.do 頁面。',
  },
  jyut: {
    closeSettings: '關閉設定',
    hideGuidelineBanner: '收埋首頁社群準則橫幅',
    hidePinnedTopics: '收埋首頁置頂話題',
    openSettings: '打開 Linux.do 設定',
    settings: 'Linux.do 設定',
    settingsDesc: '呢啲選項會套用喺而家嘅 Linux.do 頁面。',
  },
} as const

type AppLocale = keyof typeof appMessages

const appLabels = appMessages[getAppLocale(navigator.language)]
const iframeDrawerURL = ref<string>('')
const drawerBaseURL = ref<string>('')
const showIframeDrawer = ref<boolean>(false)
const showSettingsPanel = ref<boolean>(false)
const drawerCloseFallbackTimer = ref<ReturnType<typeof setTimeout> | null>(null)

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

function shouldIgnoreClick(event: MouseEvent): boolean {
  return event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
}

function handleDocumentClick(event: MouseEvent) {
  if (shouldIgnoreClick(event) || !isLinuxDoTopicListPage(location.href))
    return

  const topicUrl = findLinuxDoTopicLink(event.target, location.href)

  if (!topicUrl)
    return

  event.preventDefault()
  event.stopPropagation()
  openIframeDrawer(topicUrl)
}

function openIframeDrawer(topicUrl: string, baseUrl: string = location.href, updateHistory = true) {
  clearDrawerCloseFallback()
  drawerBaseURL.value = baseUrl
  iframeDrawerURL.value = topicUrl
  showIframeDrawer.value = true
  dispatchDrawerRouteChange({ isOpen: true, baseUrl })

  if (updateHistory)
    history.pushState(createDrawerHistoryState(topicUrl, baseUrl), '', topicUrl)
}

function handleDrawerClose() {
  const drawerState = getDrawerHistoryState(history.state)

  if (drawerState && drawerState.drawerUrl === iframeDrawerURL.value) {
    scheduleDrawerCloseFallback(drawerState.baseUrl)
    history.back()
    return
  }

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
  clearDrawerCloseFallback()
  showIframeDrawer.value = false
  iframeDrawerURL.value = ''
  drawerBaseURL.value = ''
  dispatchDrawerRouteChange({ isOpen: false })
}

function scheduleDrawerCloseFallback(baseUrl: string) {
  clearDrawerCloseFallback()
  drawerCloseFallbackTimer.value = setTimeout(() => {
    if (!showIframeDrawer.value)
      return

    hideIframeDrawer()

    if (location.href !== baseUrl)
      history.replaceState(history.state, '', baseUrl)
  }, DRAWER_HISTORY_CLOSE_FALLBACK_MS)
}

function clearDrawerCloseFallback() {
  if (!drawerCloseFallbackTimer.value)
    return

  clearTimeout(drawerCloseFallbackTimer.value)
  drawerCloseFallbackTimer.value = null
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

onMounted(() => {
  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))
})

onBeforeUnmount(() => {
  clearDrawerCloseFallback()
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
        <input v-model="settings.hideHomePageGuidelineBanner" type="checkbox">
        <span>{{ appLabels.hideGuidelineBanner }}</span>
      </label>
      <label class="linux-do-settings-option">
        <input v-model="settings.hideHomePagePinnedTopics" type="checkbox">
        <span>{{ appLabels.hidePinnedTopics }}</span>
      </label>
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
  width: min(320px, calc(100vw - 36px));
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
