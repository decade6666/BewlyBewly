import 'uno.css'

import { createApp, watch } from 'vue'
import browser from 'webextension-polyfill'

import { LINUX_DO_DRAWER_ROUTE_CHANGE } from '~/constants/globalEvents'
import { blockedWords, settings } from '~/logic'
import { hideLinuxDoHomePageElements, renderLinuxDoHomePageTopicTags } from '~/sites/linuxDo'
import RESET_BEWLY_CSS from '~/styles/reset.css?raw'
import { isInIframe } from '~/utils/main'

import { version } from '../../package.json'
import App from './views/App.vue'

interface LinuxDoDrawerRouteChangeDetail {
  isOpen: boolean
  baseUrl?: string
}

const isFirefox: boolean = /Firefox/i.test(navigator.userAgent)
let cleanupUrlOverride: string | null = null

if (isFirefox) {
  window.requestIdleCallback = window.requestIdleCallback.bind(window)
  window.cancelIdleCallback = window.cancelIdleCallback.bind(window)
  window.requestAnimationFrame = window.requestAnimationFrame.bind(window)
  window.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  window.setTimeout = window.setTimeout.bind(window)
  window.clearTimeout = window.clearTimeout.bind(window)
}

function isSupportedPage(): boolean {
  return !isInIframe()
}

function onDOMLoaded() {
  if (!isSupportedPage())
    return

  setupLinuxDoHomePageCleanup()
  injectApp()
}

if (document.readyState !== 'loading')
  onDOMLoaded()
else
  document.addEventListener('DOMContentLoaded', onDOMLoaded)

function setupLinuxDoHomePageCleanup() {
  cleanupLinuxDoHomePage()

  const observer = new MutationObserver(() => {
    cleanupLinuxDoHomePage()
  })

  observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })
  window.addEventListener(LINUX_DO_DRAWER_ROUTE_CHANGE, handleLinuxDoDrawerRouteChange)
  watch(
    () => [
      settings.value.hideHomePagePinnedTopics,
      settings.value.hideHomePageCommunityGuidelines,
      settings.value.showHomePageTopicTags,
      blockedWords.value.enabled,
      ...blockedWords.value.words,
    ],
    () => cleanupLinuxDoHomePage(),
  )
}

function handleLinuxDoDrawerRouteChange(event: Event) {
  const detail = (event as CustomEvent<LinuxDoDrawerRouteChangeDetail>).detail
  cleanupUrlOverride = detail?.isOpen && detail.baseUrl ? detail.baseUrl : null
  cleanupLinuxDoHomePage()
}

function cleanupLinuxDoHomePage() {
  const cleanupUrl = cleanupUrlOverride ?? location.href

  hideLinuxDoHomePageElements(document, cleanupUrl, {
    hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
    hideCommunityGuidelines: settings.value.hideHomePageCommunityGuidelines,
    enableBlockedWords: blockedWords.value.enabled,
    blockedWords: [...blockedWords.value.words],
  })
  renderLinuxDoHomePageTopicTags(document, cleanupUrl, settings.value.showHomePageTopicTags)
}

function injectApp() {
  document.querySelectorAll('#bewly').forEach(el => el.remove())

  const container = document.createElement('div')
  container.id = 'bewly'
  container.setAttribute('data-version', version)
  container.setAttribute('data-dev', import.meta.env.DEV ? 'true' : 'false')

  const root = document.createElement('div')
  const styleEl = document.createElement('link')
  const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container
  const resetStyleEl = document.createElement('style')

  resetStyleEl.textContent = `${RESET_BEWLY_CSS}`
  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
  shadowDOM.appendChild(resetStyleEl)
  shadowDOM.appendChild(styleEl)
  shadowDOM.appendChild(root)

  document.body.appendChild(container)

  const app = createApp(App)
  app.mount(root)
}
