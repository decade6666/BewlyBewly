import 'uno.css'

import { createApp } from 'vue'
import browser from 'webextension-polyfill'

import { hideLinuxDoHomePageElements } from '~/sites/linuxDo'
import RESET_BEWLY_CSS from '~/styles/reset.css?raw'
import { isInIframe } from '~/utils/main'

import { version } from '../../package.json'
import App from './views/App.vue'

const isFirefox: boolean = /Firefox/i.test(navigator.userAgent)

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
  hideLinuxDoHomePageElements(document, location.href)

  const observer = new MutationObserver(() => {
    hideLinuxDoHomePageElements(document, location.href)
  })

  observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })
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
