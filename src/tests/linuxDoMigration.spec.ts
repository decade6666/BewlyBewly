import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import pkg from '../../package.json'
import { getManifest } from '../manifest'
import {
  findLinuxDoTopicLink,
  isLinuxDoTopicListPage,
  normalizeLinuxDoTopicUrl,
} from '../sites/linuxDo'

const blockedLegacyTargets = /bilibili|hdslb/i

describe('linux.do migration manifest and package metadata', () => {
  it('targets Linux.do only in the extension manifest', async () => {
    const manifest = await getManifest()
    const contentScriptMatches = manifest.content_scripts?.flatMap(script => script.matches ?? []) ?? []
    const serializedManifest = JSON.stringify(manifest)

    const contentScript = manifest.content_scripts?.[0]

    expect(manifest.permissions).not.toContain('declarativeNetRequest')
    expect(manifest.permissions).not.toContain('webRequest')
    expect(manifest.permissions).not.toContain('webRequestBlocking')
    expect(manifest.permissions).not.toContain('cookies')
    expect(manifest).not.toHaveProperty('declarative_net_request')
    expect(manifest.host_permissions).toEqual(['https://linux.do/*'])
    expect(contentScriptMatches).toEqual(['https://linux.do/*'])
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ['dist/contentScripts/style.css'],
        matches: ['https://linux.do/*'],
      },
    ])
    expect(contentScript?.css).toBeUndefined()
    expect(contentScript?.all_frames).toBeUndefined()
    expect(contentScript?.match_about_blank).toBeUndefined()
    expect(serializedManifest).not.toMatch(blockedLegacyTargets)
  })

  it('uses Linux.do for local extension launch metadata', () => {
    expect(pkg.description).toMatch(/linux\.do/i)
    expect(pkg.description).not.toMatch(blockedLegacyTargets)
    expect(pkg.webExt.run.startUrl).toEqual(['https://linux.do/'])
  })
})

describe('linux.do discourse URL helpers', () => {
  it.each([
    'https://linux.do/',
    'https://linux.do/latest',
    'https://linux.do/top',
    'https://linux.do/hot',
    'https://linux.do/c/general/5',
    'https://linux.do/c/general',
  ])('recognizes topic-list page %s', (url) => {
    expect(isLinuxDoTopicListPage(url)).toBe(true)
  })

  it.each([
    'https://linux.do/t/welcome/123',
    'https://linux.do/u/example',
    'https://linux.do/admin',
    'https://example.com/latest',
  ])('rejects non-list page %s', (url) => {
    expect(isLinuxDoTopicListPage(url)).toBe(false)
  })

  it.each([
    ['/t/welcome-to-linux-do/123', 'https://linux.do/t/welcome-to-linux-do/123'],
    ['https://linux.do/t/welcome-to-linux-do/123/4', 'https://linux.do/t/welcome-to-linux-do/123/4'],
    ['https://linux.do/t/welcome-to-linux-do/123?foo=bar#post-4', 'https://linux.do/t/welcome-to-linux-do/123?foo=bar#post-4'],
  ])('normalizes same-origin topic URL %s', (input, expected) => {
    expect(normalizeLinuxDoTopicUrl(input, 'https://linux.do/latest')).toBe(expected)
  })

  it.each([
    'https://linux.do/u/example',
    'https://linux.do/c/general/5',
    'https://example.com/t/welcome/123',
    'mailto:test@example.com',
  ])('rejects non-topic URL %s', (input) => {
    expect(normalizeLinuxDoTopicUrl(input, 'https://linux.do/latest')).toBeNull()
  })

  it('finds topic links from nested click targets', () => {
    document.body.innerHTML = `
      <a class="title raw-link raw-topic-link" href="/t/welcome-to-linux-do/123">
        <span data-testid="title">Welcome</span>
      </a>
    `

    const target = document.querySelector('[data-testid="title"]')

    expect(findLinuxDoTopicLink(target, 'https://linux.do/latest')).toBe('https://linux.do/t/welcome-to-linux-do/123')
  })

  it('ignores non-topic links from nested click targets', () => {
    document.body.innerHTML = `
      <a href="/u/example">
        <span data-testid="user">User</span>
      </a>
    `

    const target = document.querySelector('[data-testid="user"]')

    expect(findLinuxDoTopicLink(target, 'https://linux.do/latest')).toBeNull()
  })
})

describe('linux.do content script and drawer boundaries', () => {
  it('keeps the content script free of Bilibili DOM assumptions', async () => {
    const entrySource = await readFile(resolve('src/contentScripts/index.ts'), 'utf8')
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const drawerSource = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')
    const source = `${entrySource}\n${appSource}\n${drawerSource}`

    expect(entrySource).toContain('import browser from \'webextension-polyfill\'')
    expect(entrySource).toContain('return !isInIframe()')
    expect(entrySource).not.toContain('isLinuxDoTopicListPage(location.href)')
    expect(entrySource).not.toContain('import \'~/styles\'')
    expect(entrySource).not.toMatch(/setupApp|logic\/common-setup|SVG_ICONS/)
    expect(appSource).toContain('isLinuxDoTopicListPage(location.href)')
    expect(appSource).toContain('findLinuxDoTopicLink(event.target, location.href)')
    expect(appSource).toContain('import IframeDrawer from \'~/components/IframeDrawer.vue\'')
    expect(drawerSource).toContain('import Button from \'~/components/Button.vue\'')
    expect(source).not.toMatch(blockedLegacyTargets)
    expect(source).not.toMatch(/bili-header|home-redesign-base|bilibili-gate-root/i)
  })

  it('removes legacy request rewriting and Firefox cookie forwarding', async () => {
    const manifestSource = await readFile(resolve('src/manifest.ts'), 'utf8')
    const backgroundSource = await readFile(resolve('src/background/index.ts'), 'utf8')
    const backgroundUtilsSource = await readFile(resolve('src/background/utils.ts'), 'utf8')

    expect(manifestSource).not.toMatch(/webRequestBlocking|webRequest|cookies/)
    expect(backgroundSource).not.toMatch(/webRequest|onBeforeSendHeaders|<all_urls>|firefox-multi-account-cookie|www\.bilibili\.com/)
    expect(backgroundSource).not.toMatch(/setupApiMsgLstnrs|messageListeners\/api/)
    expect(backgroundUtilsSource).not.toMatch(/browser\.cookies|cookieStoreId|firefox-multi-account-cookie/)
  })

  it('removes legacy Bilibili request ruleset assets', async () => {
    await expect(access(resolve('assets/rules.json'))).rejects.toThrow()
  })

  it('does not mutate top-level browser history from the iframe drawer', async () => {
    const source = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')

    expect(source).not.toMatch(/history\.(pushState|replaceState)/)
    expect(source).not.toMatch(/closeDrawerWithoutPressingEscAgain|press_esc_again_to_close/)
    expect(source).not.toMatch(blockedLegacyTargets)
    expect(source).toMatch(/copy/i)
    expect(source).toContain('sandbox="allow-scripts allow-same-origin allow-forms"')
    expect(source).toContain('addEventListener(\'keydown\', handleIframeKeydown)')
  })
})
