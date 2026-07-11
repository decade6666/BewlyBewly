import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import pkg from '../../package.json'
import { cleanLegacySettingsStorageValue, removeLegacySettingsFields } from '../logic/settingsMigration'
import { formatManifestVersion, getManifest } from '../manifest'
import {
  applyLinuxDoDrawerChrome,
  detectLinuxDoColorScheme,
  findLinuxDoTopicLink,
  hideLinuxDoHomePageElements,
  isLinuxDoHomePage,
  isLinuxDoTopicListPage,
  normalizeLinuxDoTopicUrl,
  renderLinuxDoHomePageTopicTags,
  setLinuxDoDrawerHostScrollLock,
} from '../sites/linuxDo'

const blockedLegacyTargets = /bilibili|hdslb/i

describe('linux.do migration manifest and package metadata', () => {
  it('targets Linux.do only in the extension manifest', async () => {
    const manifest = await getManifest()
    const manifestRecord = manifest as unknown as Record<string, unknown>
    const contentScriptMatches = manifest.content_scripts?.flatMap(script => script.matches ?? []) ?? []
    const serializedManifest = JSON.stringify(manifest)

    const contentScript = manifest.content_scripts?.[0]
    const chromeKey = manifestRecord.key

    expect(manifest.name).toMatch(/^BewlyLinuxDo(?: Dev)?$/)
    expect(manifest.version).toBe(formatManifestVersion(pkg.version))
    expect(manifest.description).toBe(
      'Focused drawer browsing and homepage content filtering for Linux.do.',
    )
    expect(manifest.homepage_url).toBe('https://github.com/decade6666/BewlyLinuxDo')
    expect(manifest.permissions).not.toContain('declarativeNetRequest')
    expect(manifest.permissions).not.toContain('webRequest')
    expect(manifest.permissions).not.toContain('webRequestBlocking')
    expect(manifest.permissions).not.toContain('cookies')
    expect(manifest).not.toHaveProperty('declarative_net_request')
    // Content scripts stay scoped to linux.do, but the background worker needs
    // <all_urls> so WebDAV sync can reach any user-configured server without
    // hitting the content-script origin's CORS policy.
    expect(manifest.host_permissions).toEqual(['https://linux.do/*', '<all_urls>'])
    expect(contentScriptMatches).toEqual(['https://linux.do/*'])
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ['dist/contentScripts/style.css'],
        matches: ['https://linux.do/*'],
      },
    ])
    if (typeof chromeKey !== 'string')
      throw new TypeError('Expected Chrome manifest key')
    expect(chromeKey).toMatch(/^MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A/)
    expect(contentScript?.css).toBeUndefined()
    expect(contentScript?.all_frames).toBeUndefined()
    expect(contentScript?.match_about_blank).toBeUndefined()
    expect(serializedManifest).not.toMatch(blockedLegacyTargets)
  })

  it('formats the semver package version for the WebExtension manifest', () => {
    expect(formatManifestVersion(pkg.version)).toBe(pkg.version.replace(/^(\d+\.\d+)\.0$/, '$1'))
    expect(formatManifestVersion('0.1.2')).toBe('0.1.2')
    expect(formatManifestVersion('0.2.0')).toBe('0.2')
  })

  it('uses Linux.do for local extension launch metadata', () => {
    expect(pkg.name).toBe('bewly-linux-do')
    expect(pkg.displayName).toBe('BewlyLinuxDo')
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.description).toBe(
      'Focused drawer browsing and homepage content filtering for Linux.do.',
    )
    expect(pkg.description).toMatch(/linux\.do/i)
    expect(pkg.description).not.toMatch(blockedLegacyTargets)
    expect(pkg.homepage).toBe('https://github.com/decade6666/BewlyLinuxDo')
    expect(pkg.webExt.run.startUrl).toEqual(['https://linux.do/'])
  })
})

describe('settings legacy field cleanup', () => {
  it('removes the legacy guideline banner setting without dropping other values', () => {
    const legacySettings = {
      hideHomePageGuidelineBanner: false,
      hideHomePagePinnedTopics: false,
      language: 'en',
    }

    const cleanedSettings = removeLegacySettingsFields(legacySettings)

    expect(cleanedSettings).toEqual({
      hideHomePagePinnedTopics: false,
      language: 'en',
    })
    expect(cleanedSettings).not.toHaveProperty('hideHomePageGuidelineBanner')
  })

  it('removes legacy automatic WebDAV sync keys while preserving retained WebDAV fields', () => {
    const legacySettings = {
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/bewly/settings.json',
      webdavAutoSync: true,
      webdavLastSyncTime: 123,
      webdavLocalModifiedTime: 456,
      language: 'en',
    }

    const cleanedSettings = removeLegacySettingsFields(legacySettings)

    expect(cleanedSettings).toEqual({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/bewly/settings.json',
      webdavLastSyncTime: 123,
      language: 'en',
    })
    expect(cleanedSettings).not.toHaveProperty('webdavAutoSync')
    expect(cleanedSettings).not.toHaveProperty('webdavLocalModifiedTime')
  })

  it('cleans object-shaped browser-local settings values as serialized VueUse storage values', () => {
    const legacySettings = {
      hideHomePageGuidelineBanner: true,
      hideHomePagePinnedTopics: false,
      webdavAutoSync: true,
      webdavLocalModifiedTime: 789,
      webdavEnabled: true,
      theme: 'dark',
    }

    expect(cleanLegacySettingsStorageValue(legacySettings)).toBe(JSON.stringify({
      hideHomePagePinnedTopics: false,
      webdavEnabled: true,
      theme: 'dark',
    }))
  })

  it('cleans serialized browser-local settings values including legacy automatic-sync keys', () => {
    const serializedSettings = JSON.stringify({
      hideHomePageGuidelineBanner: true,
      hideHomePagePinnedTopics: false,
      webdavAutoSync: true,
      webdavLocalModifiedTime: 789,
      webdavEnabled: true,
      webdavLastSyncTime: 123,
      theme: 'dark',
    })

    expect(cleanLegacySettingsStorageValue(serializedSettings)).toBe(JSON.stringify({
      hideHomePagePinnedTopics: false,
      webdavEnabled: true,
      webdavLastSyncTime: 123,
      theme: 'dark',
    }))
    expect(cleanLegacySettingsStorageValue('not-json')).toBe('not-json')
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
    ['https://linux.do/', true],
    ['https://linux.do', true],
    ['https://linux.do/?filter=unread', true],
    ['https://linux.do/latest', true],
    ['https://linux.do/top', false],
    ['https://linux.do/hot', false],
    ['https://linux.do/c/general', false],
    ['https://linux.do/t/welcome/123', false],
    ['https://example.com/', false],
  ])('checks homepage scope for %s', (url, expected) => {
    expect(isLinuxDoHomePage(url)).toBe(expected)
  })

  it.each([
    ['/t/welcome-to-linux-do/123', 'https://linux.do/t/welcome-to-linux-do/123/1'],
    ['https://linux.do/t/welcome-to-linux-do/123/4', 'https://linux.do/t/welcome-to-linux-do/123/1'],
    ['https://linux.do/t/welcome-to-linux-do/123?foo=bar#post-4', 'https://linux.do/t/welcome-to-linux-do/123/1'],
    ['https://linux.do/t/-/123', 'https://linux.do/t/-/123/1'],
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
      <a class="title raw-link raw-topic-link" href="/t/welcome-to-linux-do/123/9?foo=bar#post-9">
        <span data-testid="title">Welcome</span>
      </a>
    `

    const target = document.querySelector('[data-testid="title"]')

    expect(findLinuxDoTopicLink(target, 'https://linux.do/latest')).toBe('https://linux.do/t/welcome-to-linux-do/123/1')
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

describe('linux.do homepage cleanup', () => {
  it('keeps the homepage guideline banner visible by default while hiding pinned topics', () => {
    document.body.innerHTML = `
      <main>
        <section class="welcome-banner" data-testid="guideline-banner">
          <p>真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》</p>
        </section>
        <table>
          <tbody>
            <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
            <tr class="topic-list-item" data-testid="normal-topic"><td>Normal topic</td></tr>
          </tbody>
        </table>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/')

    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')
    const normalTopic = document.querySelector<HTMLElement>('[data-testid="normal-topic"]')

    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedTopic?.style.getPropertyPriority('display')).toBe('important')
    expect(normalTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('does not rewrite hidden topic attributes on repeated cleanup runs', async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/')

    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    if (!pinnedTopic)
      throw new Error('Expected pinned topic fixture')

    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))

    observer.observe(pinnedTopic, { attributes: true })
    hideLinuxDoHomePageElements(document, 'https://linux.do/')
    await new Promise(resolve => setTimeout(resolve, 0))
    observer.disconnect()

    expect(mutations).toEqual([])
  })

  it('keeps split guideline banner text visible while hiding homepage pinned topics', () => {
    document.body.innerHTML = `
      <main>
        <div id="main-outlet" data-testid="page-wrapper">
          <div class="custom-homepage-banner" data-testid="guideline-banner">
            <span>真诚、友善、团结、专业，共建你我引以为荣之社区。</span>
            <a href="/guidelines">《社区准则》</a>
          </div>
          <table>
            <tbody>
              <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/')

    const pageWrapper = document.querySelector<HTMLElement>('[data-testid="page-wrapper"]')
    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    expect(pageWrapper?.style.getPropertyValue('display')).toBe('')
    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('none')
  })

  it('hides /latest pinned topic rows without hiding normal topics', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item category-feedback has-excerpt pinned tag-公告" data-testid="pinned-class"><td>Pinned by class</td></tr>
          <tr class="topic-list-item" data-testid="pinned-icon"><td><span class="topic-status-pinned">Pinned by icon</span></td></tr>
          <tr class="topic-list-item" data-testid="pinned-title"><td><span title="此话题已置顶">Pinned by title</span></td></tr>
          <tr class="topic-list-item" data-testid="pinned-english-title"><td><span title="This topic is pinned">Pinned by English title</span></td></tr>
          <tr class="topic-list-item" data-testid="pinned-aria"><td><span aria-label="此话题已置顶">Pinned by aria</span></td></tr>
          <tr class="topic-list-item" data-testid="pinned-text-marker"><td><span>置顶</span></td></tr>
          <tr class="topic-list-item" data-testid="pinned-svg-use"><td><svg><use href="#thumbtack"></use></svg></td></tr>
          <tr class="topic-list-item" data-testid="normal-topic"><td>Normal topic</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/latest')

    const pinnedByClass = document.querySelector<HTMLElement>('[data-testid="pinned-class"]')
    const pinnedByIcon = document.querySelector<HTMLElement>('[data-testid="pinned-icon"]')
    const pinnedByTitle = document.querySelector<HTMLElement>('[data-testid="pinned-title"]')
    const pinnedByEnglishTitle = document.querySelector<HTMLElement>('[data-testid="pinned-english-title"]')
    const pinnedByAria = document.querySelector<HTMLElement>('[data-testid="pinned-aria"]')
    const pinnedByTextMarker = document.querySelector<HTMLElement>('[data-testid="pinned-text-marker"]')
    const pinnedBySvgUse = document.querySelector<HTMLElement>('[data-testid="pinned-svg-use"]')
    const normalTopic = document.querySelector<HTMLElement>('[data-testid="normal-topic"]')

    expect(pinnedByClass?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedByIcon?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedByTitle?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedByEnglishTitle?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedByAria?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedByTextMarker?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedBySvgUse?.style.getPropertyValue('display')).toBe('none')
    expect(normalTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('hides homepage pinned topic cards without hiding normal cards', () => {
    document.body.innerHTML = `
      <section class="topic-list" data-testid="topic-list">
        <article class="topic-list-item pinned" data-testid="pinned-card">
          <a href="/t/pinned/123">Pinned topic card</a>
        </article>
        <div class="topic-list-item" data-pinned="true" data-testid="pinned-data-card">
          <a href="/t/pinned-data/456">Pinned data card</a>
        </div>
        <div class="topic-list-item" data-testid="normal-card">
          <a href="/t/normal/789">Normal topic card</a>
        </div>
      </section>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/')

    const topicList = document.querySelector<HTMLElement>('[data-testid="topic-list"]')
    const pinnedCard = document.querySelector<HTMLElement>('[data-testid="pinned-card"]')
    const pinnedDataCard = document.querySelector<HTMLElement>('[data-testid="pinned-data-card"]')
    const normalCard = document.querySelector<HTMLElement>('[data-testid="normal-card"]')

    expect(topicList?.style.getPropertyValue('display')).toBe('')
    expect(pinnedCard?.style.getPropertyValue('display')).toBe('none')
    expect(pinnedDataCard?.style.getPropertyValue('display')).toBe('none')
    expect(normalCard?.style.getPropertyValue('display')).toBe('')
  })

  it('keeps the homepage guideline banner visible when pinned topic cleanup is enabled', () => {
    document.body.innerHTML = `
      <main>
        <section class="welcome-banner" data-testid="guideline-banner">
          <p>真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》</p>
        </section>
        <table>
          <tbody>
            <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
          </tbody>
        </table>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: true,
    })

    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('none')
  })

  it('keeps homepage pinned topics visible when pinned topic cleanup is disabled', () => {
    document.body.innerHTML = `
      <main>
        <section class="welcome-banner" data-testid="guideline-banner">
          <p>真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》</p>
        </section>
        <table>
          <tbody>
            <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
          </tbody>
        </table>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
    })

    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('restores homepage pinned topics when cleanup is disabled after hiding', () => {
    document.body.innerHTML = `
      <main>
        <section class="welcome-banner" data-testid="guideline-banner" style="display: block;">
          <p>真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》</p>
        </section>
        <table>
          <tbody>
            <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
          </tbody>
        </table>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/')
    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
    })

    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    expect(banner?.style.getPropertyValue('display')).toBe('block')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('hides homepage topic items that include a blocked word ignoring case', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item" data-testid="blocked-topic"><td>Discuss CLAUDE Code workflows</td></tr>
          <tr class="topic-list-item" data-testid="normal-topic"><td>Linux.do daily notes</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: [' claude '],
    })

    const blockedTopic = document.querySelector<HTMLElement>('[data-testid="blocked-topic"]')
    const normalTopic = document.querySelector<HTMLElement>('[data-testid="normal-topic"]')

    expect(blockedTopic?.style.getPropertyValue('display')).toBe('none')
    expect(blockedTopic?.style.getPropertyPriority('display')).toBe('important')
    expect(normalTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('preserves nonmatching topic display styles while blocked-word filtering is enabled', () => {
    document.body.innerHTML = `
      <section class="topic-list">
        <article class="topic-list-item" data-testid="normal-topic" style="display: grid;">
          Linux.do daily notes
        </article>
      </section>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: ['claude'],
    })

    const normalTopic = document.querySelector<HTMLElement>('[data-testid="normal-topic"]')

    expect(normalTopic?.style.getPropertyValue('display')).toBe('grid')
  })

  it('hides /latest topic items that match a blocked regex', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item" data-testid="regex-topic"><td>抽奖活动集中讨论</td></tr>
          <tr class="topic-list-item" data-testid="normal-topic"><td>开发经验分享</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/latest', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: ['/抽奖|raffle/'],
    })

    const regexTopic = document.querySelector<HTMLElement>('[data-testid="regex-topic"]')
    const normalTopic = document.querySelector<HTMLElement>('[data-testid="normal-topic"]')

    expect(regexTopic?.style.getPropertyValue('display')).toBe('none')
    expect(normalTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('ignores invalid blocked-word regex entries without crashing cleanup', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item" data-testid="topic"><td>Any topic text</td></tr>
        </tbody>
      </table>
    `

    expect(() => hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: ['/[invalid/'],
    })).not.toThrow()

    const topic = document.querySelector<HTMLElement>('[data-testid="topic"]')

    expect(topic?.style.getPropertyValue('display')).toBe('')
  })

  it('restores topics hidden only by blocked words when the switch is disabled', () => {
    document.body.innerHTML = `
      <section class="topic-list">
        <article class="topic-list-item" data-testid="blocked-topic" style="display: grid;">
          Giveaway keyword match
        </article>
      </section>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: ['giveaway'],
    })
    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: false,
      blockedWords: ['giveaway'],
    })

    const blockedTopic = document.querySelector<HTMLElement>('[data-testid="blocked-topic"]')

    expect(blockedTopic?.style.getPropertyValue('display')).toBe('grid')
    expect(blockedTopic?.style.getPropertyPriority('display')).toBe('')
  })

  it('does not hide blocked-word matches on non-homepage pages', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item" data-testid="blocked-topic"><td>Blocked keyword match</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/t/welcome/123', {
      hidePinnedTopics: false,
      enableBlockedWords: true,
      blockedWords: ['blocked'],
    })

    const blockedTopic = document.querySelector<HTMLElement>('[data-testid="blocked-topic"]')

    expect(blockedTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('keeps pinned-topic hiding independent from blocked-word hiding', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item pinned" data-testid="pinned-blocked-topic"><td>Prize keyword match</td></tr>
          <tr class="topic-list-item" data-testid="blocked-topic"><td>Prize keyword match</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: true,
      enableBlockedWords: true,
      blockedWords: ['prize'],
    })

    const pinnedBlockedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-blocked-topic"]')
    const blockedTopic = document.querySelector<HTMLElement>('[data-testid="blocked-topic"]')

    expect(pinnedBlockedTopic?.style.getPropertyValue('display')).toBe('none')
    expect(blockedTopic?.style.getPropertyValue('display')).toBe('none')

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: true,
      enableBlockedWords: false,
      blockedWords: ['prize'],
    })

    expect(pinnedBlockedTopic?.style.getPropertyValue('display')).toBe('none')
    expect(blockedTopic?.style.getPropertyValue('display')).toBe('')

    hideLinuxDoHomePageElements(document, 'https://linux.do/', {
      hidePinnedTopics: false,
      enableBlockedWords: false,
      blockedWords: ['prize'],
    })

    expect(pinnedBlockedTopic?.style.getPropertyValue('display')).toBe('')
  })

  it('keeps screenshot-style homepage guideline strip visible while hiding real pinned topic rows', () => {
    document.body.innerHTML = `
      <main>
        <header data-testid="hero">Where possible begins</header>
        <div class="site-intro-strip" data-testid="guideline-banner">
          <div>
            <strong>真诚、友善、团结、专业，共建你我引以为荣之社区。</strong>
            <a href="/guidelines">《社区准则》</a>
          </div>
        </div>
        <section class="topic-list" data-testid="topic-list">
          <table>
            <tbody>
              <tr class="topic-list-item category-feedback has-excerpt pinned tag-公告" data-testid="pinned-row">
                <td>进一步优化对抽奖帖回复被举报的处理方式</td>
              </tr>
              <tr class="topic-list-item" data-testid="normal-row">
                <td>Normal topic</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/latest')

    const hero = document.querySelector<HTMLElement>('[data-testid="hero"]')
    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const topicList = document.querySelector<HTMLElement>('[data-testid="topic-list"]')
    const pinnedRow = document.querySelector<HTMLElement>('[data-testid="pinned-row"]')
    const normalRow = document.querySelector<HTMLElement>('[data-testid="normal-row"]')

    expect(hero?.style.getPropertyValue('display')).toBe('')
    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(topicList?.style.getPropertyValue('display')).toBe('')
    expect(pinnedRow?.style.getPropertyValue('display')).toBe('none')
    expect(normalRow?.style.getPropertyValue('display')).toBe('')
  })

  it('does not hide the body or layout containers that mention topic cards', () => {
    document.body.className = 'uc-enable-horizon-high-context-topic-cards'
    document.body.innerHTML = `
      <main class="topic-card-layout" data-testid="layout">
        <table>
          <tbody>
            <tr class="topic-list-item category-feedback has-excerpt pinned tag-公告" data-testid="pinned-row">
              <td><span class="topic-status-pinned">Pinned topic</span></td>
            </tr>
            <tr class="topic-list-item" data-testid="normal-row"><td>Normal topic</td></tr>
          </tbody>
        </table>
      </main>
    `

    hideLinuxDoHomePageElements(document, 'https://linux.do/latest')

    const layout = document.querySelector<HTMLElement>('[data-testid="layout"]')
    const pinnedRow = document.querySelector<HTMLElement>('[data-testid="pinned-row"]')
    const normalRow = document.querySelector<HTMLElement>('[data-testid="normal-row"]')

    expect(document.body.style.getPropertyValue('display')).toBe('')
    expect(layout?.style.getPropertyValue('display')).toBe('')
    expect(pinnedRow?.style.getPropertyValue('display')).toBe('none')
    expect(normalRow?.style.getPropertyValue('display')).toBe('')
  })

  it.each([
    'https://linux.do/c/general',
    'https://linux.do/t/welcome/123',
  ])('does not hide homepage-only elements on non-homepage page %s', (url) => {
    document.body.className = ''
    document.body.innerHTML = `
      <section class="welcome-banner" data-testid="guideline-banner">
        真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》
      </section>
      <table>
        <tbody>
          <tr class="topic-list-item pinned" data-testid="pinned-topic"><td>Pinned topic</td></tr>
        </tbody>
      </table>
    `

    hideLinuxDoHomePageElements(document, url)

    const banner = document.querySelector<HTMLElement>('[data-testid="guideline-banner"]')
    const pinnedTopic = document.querySelector<HTMLElement>('[data-testid="pinned-topic"]')

    expect(banner?.style.getPropertyValue('display')).toBe('')
    expect(pinnedTopic?.style.getPropertyValue('display')).toBe('')
  })
})

describe('linux.do homepage topic tags', () => {
  const topicRowFixture = (rowClass: string, badge = true) => `
    <table>
      <tbody>
        <tr class="topic-list-item ${rowClass}" data-testid="topic">
          <td class="main-link">
            <span class="link-top-line"><a class="title raw-topic-link" href="/t/welcome/123">Welcome</a></span>
            <span class="link-bottom-line">${badge ? '<a class="badge-wrapper" href="/c/feedback/2"><span class="badge-category">反馈</span></a>' : ''}</span>
          </td>
        </tr>
      </tbody>
    </table>
  `
  const horizonTopicRowFixture = (bottomLineHidden = true, rowClass = 'category-feedback tag-公告') => `
    <table>
      <tbody>
        <tr class="topic-list-item ${rowClass}" data-testid="topic">
          <td class="main-link topic-list-data">
            <div class="link-bottom-line"${bottomLineHidden ? ' style="display: none"' : ''}>
              <a class="badge-category__wrapper" href="/c/feedback/2">运营反馈</a>
            </div>
          </td>
          <td class="topic-category-data">
            <a class="badge-category__wrapper" href="/c/feedback/2">运营反馈</a>
          </td>
        </tr>
      </tbody>
    </table>
  `

  it('injects tag links after the category badge from tag-* classes', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals tag-free-stuff')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const badge = document.querySelector<HTMLAnchorElement>('a.badge-wrapper[href^="/c/"]')
    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')
    const links = Array.from(container?.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]') ?? [])

    expect(badge?.nextElementSibling).toBe(container)
    expect(container?.style.display).toBe('inline-flex')
    expect(container?.style.flexWrap).toBe('nowrap')
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/deals', '/tag/free-stuff'])
    expect(links.map(link => link.textContent)).toEqual(['deals', 'free-stuff'])
    expect(links.every(link => link.classList.contains('discourse-tag'))).toBe(true)
  })

  it('builds an encoded href while keeping the raw tag name as display text', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-公告')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const link = document.querySelector<HTMLAnchorElement>('[data-bewly-topic-tag]')

    expect(link?.textContent).toBe('公告')
    expect(decodeURIComponent(link?.getAttribute('href') ?? '')).toBe('/tag/公告')
  })

  it('uses native Discourse tag metadata instead of category-like row class tokens', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item category-gossip tag-gossip tag-快问快答" data-testid="topic">
            <td class="main-link topic-list-data">
              <div class="link-bottom-line" style="display: none">
                <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
                <ul class="discourse-tags">
                  <li>
                    <a class="discourse-tag box" data-tag-name="快问快答" href="/tag/1436-tag/1436">快问快答</a>
                  </li>
                </ul>
              </div>
            </td>
            <td class="topic-category-data">
              <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
            </td>
          </tr>
        </tbody>
      </table>
    `

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(links.map(link => link.textContent)).toEqual(['快问快答'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/1436-tag/1436'])
  })

  it('falls back to row tag classes when native tag anchors have no labels', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item category-gossip tag-gossip tag-纯水" data-testid="topic">
            <td class="main-link topic-list-data">
              <div class="link-bottom-line" style="display: none">
                <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
                <ul class="discourse-tags">
                  <li><a class="discourse-tag box" href="/tag/empty"></a></li>
                </ul>
              </div>
            </td>
            <td class="topic-category-data">
              <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
            </td>
          </tr>
        </tbody>
      </table>
    `

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(links.map(link => link.textContent)).toEqual(['纯水'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/%E7%BA%AF%E6%B0%B4'])
  })

  it('fills native tag metadata gaps with fallback row tag classes', () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr class="topic-list-item category-gossip tag-gossip tag-快问快答 tag-纯水" data-testid="topic">
            <td class="main-link topic-list-data">
              <div class="link-bottom-line" style="display: none">
                <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
                <ul class="discourse-tags">
                  <li><a class="discourse-tag box" data-tag-name="快问快答" href="/tag/1436-tag/1436">快问快答</a></li>
                  <li><a class="discourse-tag box" href="/tag/empty"></a></li>
                </ul>
              </div>
            </td>
            <td class="topic-category-data">
              <a class="badge-category__wrapper" href="/c/gossip/11">搞七捻三</a>
            </td>
          </tr>
        </tbody>
      </table>
    `

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(links.map(link => link.textContent)).toEqual(['快问快答', '纯水'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/1436-tag/1436', '/tag/%E7%BA%AF%E6%B0%B4'])
  })

  it('does not treat a category slug class as a fallback tag label', () => {
    document.body.innerHTML = topicRowFixture('category-gossip tag-gossip tag-纯水')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(links.map(link => link.textContent)).toEqual(['纯水'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/%E7%BA%AF%E6%B0%B4'])
  })

  it('does not inject anything for rows without tag-* classes', () => {
    document.body.innerHTML = topicRowFixture('category-feedback')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    expect(document.querySelector('[data-bewly-topic-tags]')).toBeNull()
  })

  it('does not run on non-homepage pages', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/c/general', true)
    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/t/welcome/123', true)

    expect(document.querySelector('[data-bewly-topic-tags]')).toBeNull()
  })

  it('is idempotent and does not retrigger mutations on repeated runs', async () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals tag-news')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const row = document.querySelector<HTMLElement>('[data-testid="topic"]')

    if (!row)
      throw new Error('Expected topic fixture')

    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))

    observer.observe(row, { attributes: true, childList: true, characterData: true, subtree: true })
    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)
    await new Promise(resolve => setTimeout(resolve, 0))
    observer.disconnect()

    expect(mutations).toEqual([])
    expect(document.querySelectorAll('[data-bewly-topic-tags]')).toHaveLength(1)
  })

  it('rebuilds injected tags when the row tag set changes', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const row = document.querySelector<HTMLElement>('[data-testid="topic"]')
    row?.classList.add('tag-news')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const containers = document.querySelectorAll('[data-bewly-topic-tags]')
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(containers).toHaveLength(1)
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/deals', '/tag/news'])
  })

  it('rebuilds fallback tags when native tag metadata becomes available', () => {
    document.body.innerHTML = topicRowFixture('category-gossip tag-快问快答')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const bottomLine = document.querySelector<HTMLElement>('.link-bottom-line')
    bottomLine?.insertAdjacentHTML(
      'beforeend',
      '<ul class="discourse-tags"><li><a class="discourse-tag box" data-tag-name="快问快答" href="/tag/1436-tag/1436">快问快答</a></li></ul>',
    )

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const containers = document.querySelectorAll('[data-bewly-topic-tags]')
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(containers).toHaveLength(1)
    expect(links.map(link => link.textContent)).toEqual(['快问快答'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/tag/1436-tag/1436'])
  })

  it('removes injected tags when the feature is disabled', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)
    expect(document.querySelector('[data-bewly-topic-tags]')).not.toBeNull()

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', false)
    expect(document.querySelector('[data-bewly-topic-tags]')).toBeNull()
  })

  it('falls back to the bottom line when no category badge exists', () => {
    document.body.innerHTML = topicRowFixture('tag-deals', false)

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const bottomLine = document.querySelector<HTMLElement>('.link-bottom-line')
    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')

    expect(container?.parentElement).toBe(bottomLine)
  })

  it('repositions an existing container after the visible category badge when tags are unchanged', () => {
    document.body.innerHTML = topicRowFixture('category-feedback tag-deals')

    const bottomLine = document.querySelector<HTMLElement>('.link-bottom-line')

    bottomLine?.insertAdjacentHTML(
      'beforeend',
      '<span class="discourse-tags bewly-injected-tags" data-bewly-topic-tags><a class="discourse-tag box" data-bewly-topic-tag href="/tag/deals">deals</a></span><a class="badge-wrapper" href="/c/feedback/2"><span class="badge-category">重复分类</span></a>',
    )

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const badge = document.querySelector<HTMLAnchorElement>('a.badge-wrapper[href^="/c/"]')
    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')

    expect(document.querySelectorAll('[data-bewly-topic-tags]')).toHaveLength(1)
    expect(badge?.nextElementSibling).toBe(container)
  })

  it('injects into the visible category cell when Horizon hides the first bottom line', () => {
    document.body.innerHTML = horizonTopicRowFixture(true)

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')

    expect(container).toBeTruthy()
    expect(container?.style.display).toBe('inline-flex')
    expect(container?.style.flexWrap).toBe('nowrap')
    expect(container?.closest('.link-bottom-line')).toBeNull()
    expect(container?.closest('td.topic-category-data')).toBeTruthy()
  })

  it('keeps multiple Horizon tags on one line inside the visible category cell', () => {
    document.body.innerHTML = horizonTopicRowFixture(true, 'category-feedback tag-人工智能 tag-软件开发 tag-开源推广 tag-Codex tag-ClaudeCode')

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-bewly-topic-tag]'))

    expect(links.map(link => link.textContent)).toEqual(['人工智能', '软件开发', '开源推广', 'Codex', 'ClaudeCode'])
    expect(container?.style.display).toBe('inline-flex')
    expect(container?.style.flexWrap).toBe('nowrap')
  })

  it('relocates an injected container out of a hidden Horizon bottom line on rerun', () => {
    document.body.innerHTML = horizonTopicRowFixture(true)

    document.querySelector('.link-bottom-line')?.insertAdjacentHTML(
      'beforeend',
      '<span class="discourse-tags bewly-injected-tags" data-bewly-topic-tags><a class="discourse-tag box" data-bewly-topic-tag href="/tag/%E5%85%AC%E5%91%8A">公告</a></span>',
    )

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const containers = document.querySelectorAll<HTMLElement>('[data-bewly-topic-tags]')
    const container = containers[0]

    expect(containers).toHaveLength(1)
    expect(container?.closest('.link-bottom-line')).toBeNull()
    expect(container?.closest('td.topic-category-data')).toBeTruthy()
  })

  it('keeps default and MOYU behavior when the first bottom line stays visible', () => {
    document.body.innerHTML = horizonTopicRowFixture(false)

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/latest', true)

    const container = document.querySelector<HTMLElement>('[data-bewly-topic-tags]')

    expect(container).toBeTruthy()
    expect(container?.closest('.link-bottom-line')).toBeTruthy()
  })
})

describe('linux.do drawer hidden chrome', () => {
  it('injects a style that hides the sidebar and the full site header', () => {
    const doc = document.implementation.createHTMLDocument('drawer')

    applyLinuxDoDrawerChrome(doc)

    const style = doc.getElementById('bewly-drawer-hidden-chrome')

    expect(style?.tagName).toBe('STYLE')
    expect(style?.parentElement).toBe(doc.head)
    expect(style?.textContent).toContain('html,')
    expect(style?.textContent).toContain('body {')
    expect(style?.textContent).toContain('background: var(--secondary, #fff) !important')
    expect(style?.textContent).toContain('.sidebar-wrapper,')
    expect(style?.textContent).toContain('.d-header {')
    expect(style?.textContent).toContain('#main-outlet-wrapper')
    expect(style?.textContent).toContain('grid-template-columns: 0 minmax(0, 1fr) !important')
    expect(style?.textContent).toContain('#main-outlet')
    expect(style?.textContent).toContain('grid-column: 1 / -1 !important')
    expect(style?.textContent).toContain('display: none !important')
  })

  it('keeps the drawer backdrop opaque so host page chrome cannot show through', async () => {
    const drawerSource = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')

    expect(drawerSource).toContain('bg="black"')
    expect(drawerSource).not.toContain('opacity-60')
  })

  it('is idempotent across repeated calls on the same document', () => {
    const doc = document.implementation.createHTMLDocument('drawer')

    applyLinuxDoDrawerChrome(doc)
    applyLinuxDoDrawerChrome(doc)

    expect(doc.querySelectorAll('#bewly-drawer-hidden-chrome')).toHaveLength(1)
  })

  it('does nothing when the iframe document is unavailable', () => {
    expect(() => applyLinuxDoDrawerChrome(null)).not.toThrow()
    expect(() => applyLinuxDoDrawerChrome(undefined)).not.toThrow()
  })
})

describe('linux.do drawer host scroll lock', () => {
  it('locks the host document scroll while the drawer is open', () => {
    const doc = document.implementation.createHTMLDocument('drawer')

    setLinuxDoDrawerHostScrollLock(true, doc)

    expect(doc.documentElement.style.overflow).toBe('hidden')
  })

  it('restores the previous overflow value when unlocking', () => {
    const doc = document.implementation.createHTMLDocument('drawer')
    doc.documentElement.style.overflow = 'scroll'

    setLinuxDoDrawerHostScrollLock(true, doc)
    setLinuxDoDrawerHostScrollLock(false, doc)

    expect(doc.documentElement.style.overflow).toBe('scroll')
  })

  it('restores an empty overflow when nothing was set before locking', () => {
    const doc = document.implementation.createHTMLDocument('drawer')

    setLinuxDoDrawerHostScrollLock(true, doc)
    setLinuxDoDrawerHostScrollLock(false, doc)

    expect(doc.documentElement.style.overflow).toBe('')
  })

  it('restores a preset padding-right instead of clearing it', () => {
    const doc = document.implementation.createHTMLDocument('drawer')
    doc.documentElement.style.paddingRight = '7px'

    setLinuxDoDrawerHostScrollLock(true, doc)
    setLinuxDoDrawerHostScrollLock(false, doc)

    expect(doc.documentElement.style.paddingRight).toBe('7px')
  })

  it('is idempotent so repeated locks keep the original saved value', () => {
    const doc = document.implementation.createHTMLDocument('drawer')
    doc.documentElement.style.overflow = 'auto'

    setLinuxDoDrawerHostScrollLock(true, doc)
    setLinuxDoDrawerHostScrollLock(true, doc)
    setLinuxDoDrawerHostScrollLock(false, doc)

    expect(doc.documentElement.style.overflow).toBe('auto')
  })

  it('does nothing when the host document is unavailable', () => {
    expect(() => setLinuxDoDrawerHostScrollLock(true, null)).not.toThrow()
    expect(() => setLinuxDoDrawerHostScrollLock(false, null)).not.toThrow()
    expect(() => setLinuxDoDrawerHostScrollLock(true, undefined)).not.toThrow()
  })

  it('wires the host scroll lock to drawer visibility in the content script app', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')

    expect(appSource).toContain('setLinuxDoDrawerHostScrollLock')
    expect(appSource).toContain('watch(showIframeDrawer')
  })
})

describe('detectLinuxDoColorScheme', () => {
  it('returns dark when --scheme-type is dark', () => {
    const doc = createMockDocument({ '--scheme-type': 'dark' })

    expect(detectLinuxDoColorScheme(doc)).toBe('dark')
  })

  it('returns light when --scheme-type is light', () => {
    const doc = createMockDocument({ '--scheme-type': 'light' })

    expect(detectLinuxDoColorScheme(doc)).toBe('light')
  })

  it('falls back to --secondary luminance for dark background', () => {
    const doc = createMockDocument({ '--secondary': '#222222' })

    expect(detectLinuxDoColorScheme(doc)).toBe('dark')
  })

  it('falls back to --secondary luminance for light background', () => {
    const doc = createMockDocument({ '--secondary': '#ffffff' })

    expect(detectLinuxDoColorScheme(doc)).toBe('light')
  })

  it('falls back to rgb() format', () => {
    const doc = createMockDocument({ '--secondary': 'rgb(34, 34, 34)' })

    expect(detectLinuxDoColorScheme(doc)).toBe('dark')
  })

  it('falls back to short hex #rgb format', () => {
    const doc = createMockDocument({ '--secondary': '#fff' })

    expect(detectLinuxDoColorScheme(doc)).toBe('light')
  })

  it('returns light for null document', () => {
    expect(detectLinuxDoColorScheme(null)).toBe('light')
  })

  it('returns light for undefined document', () => {
    expect(detectLinuxDoColorScheme(undefined)).toBe('light')
  })
})

function createMockDocument(cssVars: Record<string, string>): Document {
  const doc = {
    documentElement: {},
    defaultView: {
      getComputedStyle() {
        return {
          getPropertyValue(name: string) {
            return cssVars[name] ?? ''
          },
        }
      },
    },
  } as unknown as Document

  return doc
}

describe('app.vue host dark mode detection', () => {
  it('binds dark class on the extension root based on isHostDark', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')

    expect(appSource).toContain(':class="{ dark: isHostDark }"')
    expect(appSource).toContain('detectLinuxDoColorScheme')
    expect(appSource).toContain('const isHostDark = ref(false)')
    expect(appSource).toContain('updateHostDarkScheme')
    expect(appSource).toContain('MutationObserver')
    expect(appSource).toContain('matchMedia')
    expect(appSource).toContain('.linux-do-extension-root.dark')
  })
})

describe('linux.do content script and drawer boundaries', () => {
  it('keeps the content script free of Bilibili DOM assumptions', async () => {
    const entrySource = await readFile(resolve('src/contentScripts/index.ts'), 'utf8')
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const drawerSource = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')
    const source = `${entrySource}\n${appSource}\n${drawerSource}`

    expect(entrySource).toContain('import browser from \'webextension-polyfill\'')
    expect(entrySource).toContain('import { LINUX_DO_DRAWER_ROUTE_CHANGE } from \'~/constants/globalEvents\'')
    expect(entrySource).toMatch(/import \{[^}]*\bsettings\b[^}]*\} from '~\/logic'/)
    expect(entrySource).toContain('return !isInIframe()')
    expect(entrySource).toContain('hideLinuxDoHomePageElements(document, cleanupUrl, {')
    expect(entrySource).toContain('renderLinuxDoHomePageTopicTags(document, cleanupUrl, settings.value.showHomePageTopicTags)')
    expect(entrySource).toContain('hidePinnedTopics: settings.value.hideHomePagePinnedTopics')
    expect(entrySource).toContain('enableBlockedWords: blockedWords.value.enabled')
    expect(entrySource).toContain('blockedWords: [...blockedWords.value.words]')
    expect(entrySource).not.toContain('hideGuidelineBanner')
    expect(entrySource).not.toContain('hideHomePageGuidelineBanner')
    expect(entrySource).toContain('observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })')
    expect(entrySource).toContain('watch(')
    expect(entrySource).toContain('settings.value.hideHomePagePinnedTopics')
    expect(entrySource).toContain('settings.value.showHomePageTopicTags')
    expect(entrySource).toContain('blockedWords.value.enabled')
    expect(entrySource).toContain('...blockedWords.value.words')
    expect(entrySource).not.toContain('isLinuxDoTopicListPage(location.href)')
    expect(entrySource).not.toContain('import \'~/styles\'')
    expect(entrySource).not.toMatch(/setupApp|logic\/common-setup|SVG_ICONS/)
    expect(appSource).toContain('isLinuxDoTopicListPage(location.href)')
    expect(appSource).toContain('findLinuxDoTopicLink(getClickTarget(event), location.href)')
    expect(appSource).toContain('event.composedPath()')
    expect(appSource).toContain('history.pushState(createDrawerHistoryState(topicUrl, baseUrl), \'\', topicUrl)')
    expect(appSource).toContain('useEventListener(window, \'popstate\', handlePopState)')
    expect(appSource).toContain('class="linux-do-settings-button"')
    expect(appSource).toContain('settings.hideHomePagePinnedTopics')
    expect(appSource).toContain('settings.showHomePageTopicTags')
    expect(appSource).toContain('blockedWords.enabled')
    expect(appSource).toContain('blockedWords.words')
    expect(appSource).toContain('handleBlockedWordsImport')
    expect(appSource).toContain('handleBlockedWordsExport')
    expect(appSource).not.toMatch(/hideGuidelineBanner|hideHomePageGuidelineBanner|Hide homepage guideline banner|隐藏首页社区准则横幅/)
    expect(appSource).toContain('import IframeDrawer from \'~/components/IframeDrawer.vue\'')
    expect(drawerSource).toContain('import Button from \'~/components/Button.vue\'')
    expect(source).not.toMatch(blockedLegacyTargets)
    expect(source).not.toMatch(/bili-header|home-redesign-base|bilibili-gate-root/i)
  })

  it('removes guideline banner controls, locale keys, and settings defaults', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const storageSource = await readFile(resolve('src/logic/storage.ts'), 'utf8')
    const migrationSource = await readFile(resolve('src/logic/settingsMigration.ts'), 'utf8')
    const enLocaleSource = await readFile(resolve('src/_locales/en.yml'), 'utf8')
    const cmnCNLocaleSource = await readFile(resolve('src/_locales/cmn-CN.yml'), 'utf8')

    expect(appSource).not.toMatch(/hideGuidelineBanner|hideHomePageGuidelineBanner|Hide homepage guideline banner|隐藏首页社区准则横幅/)
    expect(storageSource).not.toContain('hideHomePageGuidelineBanner')
    expect(storageSource).toContain('showHomePageTopicTags: boolean')
    expect(storageSource).toContain('showHomePageTopicTags: true')
    // Blocked words moved out of local Settings into storage.sync so they
    // survive uninstall/reinstall and roam across devices. The legacy field
    // names may still appear inside the one-time migration helper.
    expect(storageSource).not.toContain('enableHomePageBlockedWords: boolean')
    expect(storageSource).not.toContain('homePageBlockedWords: string[]')
    expect(storageSource).not.toContain('homePageBlockedWords: []')
    expect(storageSource).toContain('interface BlockedWordsState')
    expect(storageSource).toContain('export const blockedWords = useStorageSync(')
    expect(storageSource).toContain('migrateBlockedWordsToSync')
    expect(storageSource).toContain('void cleanupLegacySettingsStorage()')
    expect(storageSource).toContain('cleanLegacySettingsStorageValue(storedSettings)')
    expect(migrationSource).toContain('const LEGACY_SETTINGS_KEYS = [\'hideHomePageGuidelineBanner\', \'webdavAutoSync\', \'webdavLocalModifiedTime\'] as const')
    expect(enLocaleSource).not.toContain('hide_homepage_guideline_banner')
    expect(cmnCNLocaleSource).not.toContain('hide_homepage_guideline_banner')
  })

  it('removes automatic WebDAV sync and keeps the manual version-1 envelope plus blocked words', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const indexSource = await readFile(resolve('src/contentScripts/index.ts'), 'utf8')
    const settingsSyncSource = await readFile(resolve('src/logic/settingsSync.ts'), 'utf8')
    const storageSource = await readFile(resolve('src/logic/storage.ts'), 'utf8')
    const logicIndexSource = await readFile(resolve('src/logic/index.ts'), 'utf8')
    const webdavSettingsSource = await readFile(resolve('src/logic/webdavSettings.ts'), 'utf8')
    const manifestSource = await readFile(resolve('src/manifest.ts'), 'utf8')

    // Automatic sync lifecycle is gone from the content script; the Vue watch
    // import stays for homepage cleanup.
    expect(indexSource).not.toContain('setupAutoSync')
    expect(indexSource).not.toContain('autoDownloadOnStartup')
    expect(indexSource).not.toContain('setupSettingsSync')
    expect(indexSource).not.toContain('webdavAutoSync')
    expect(indexSource).toMatch(/import \{ createApp, watch \} from 'vue'/)
    expect(indexSource).toContain('cleanupLinuxDoHomePage()')

    // Automatic-only state and exports are gone from settingsSync; the manual
    // version-1 envelope, blocked-word cloning, local WebDAV exclusion, and
    // last-sync updates remain.
    expect(settingsSyncSource).toContain('import type { BlockedWordsState, Settings } from \'./storage\'')
    expect(settingsSyncSource).toContain('import { blockedWords, originalSettings, settings } from \'./storage\'')
    expect(settingsSyncSource).toContain('blockedWords: BlockedWordsState')
    expect(settingsSyncSource).toContain('function buildSyncState()')
    expect(settingsSyncSource).toContain('function cloneBlockedWordsState')
    expect(settingsSyncSource).toContain('blockedWords: cloneBlockedWordsState(blockedWords.value)')
    expect(settingsSyncSource).toContain('webdavUploadViaBackground')
    expect(settingsSyncSource).toContain('webdavDownloadViaBackground')
    expect(settingsSyncSource).toContain('version: 1')
    expect(settingsSyncSource).toContain('webdavLastSyncTime: envelope.timestamp')
    expect(settingsSyncSource).not.toMatch(/\bsetupAutoSync\b/)
    expect(settingsSyncSource).not.toMatch(/\bautoDownloadOnStartup\b/)
    expect(settingsSyncSource).not.toMatch(/\blastSyncedSnapshot\b/)
    expect(settingsSyncSource).not.toMatch(/\bbuildSyncSnapshot\b/)
    expect(settingsSyncSource).not.toMatch(/\bapplyingRemote\b/)
    expect(settingsSyncSource).not.toMatch(/\bautoSyncTimer\b/)
    expect(settingsSyncSource).not.toMatch(/\bautoSyncUnwatch\b/)
    expect(settingsSyncSource).not.toMatch(/onlyIfNewer/)
    expect(settingsSyncSource).not.toMatch(/\bwebdavAutoSync\b/)
    expect(settingsSyncSource).not.toMatch(/\bwebdavLocalModifiedTime\b/)
    expect(settingsSyncSource).toContain('function buildDownloadedSettings')
    expect(settingsSyncSource).toContain('blockedWords.value = cloneBlockedWordsState')

    // Retained WebDAV persisted fields detect explicit automatic-sync removal.
    expect(storageSource).toContain('webdavEnabled: boolean')
    expect(storageSource).toContain('webdavUrl: string')
    expect(storageSource).toContain('webdavUsername: string')
    expect(storageSource).toContain('webdavPassword: string')
    expect(storageSource).toContain('webdavPath: string')
    expect(storageSource).toContain('webdavLastSyncTime: number')
    expect(storageSource).not.toContain('webdavAutoSync: boolean')
    expect(storageSource).not.toContain('webdavLocalModifiedTime: number')
    expect(storageSource).not.toContain('webdavAutoSync: false')
    expect(storageSource).not.toContain('webdavLocalModifiedTime: 0')

    // The pure draft helper module is exported through the logic barrel.
    expect(logicIndexSource).toContain('webdavSettings')
    expect(webdavSettingsSource).toContain('export const DEFAULT_WEBDAV_PATH = \'/bewly/settings.json\'')
    expect(webdavSettingsSource).toContain('export function copyWebdavDraft')
    expect(webdavSettingsSource).toContain('export function normalizeDraft')
    expect(webdavSettingsSource).toContain('export function validateSaveDraft')
    expect(webdavSettingsSource).toContain('export function validateTestDraft')
    expect(webdavSettingsSource).toContain('export function isDraftDirty')
    expect(webdavSettingsSource).toContain('export function isSavedConfigUsable')
    expect(webdavSettingsSource).toContain('export function mergeWebdavFields')
    expect(webdavSettingsSource).toContain('export function isAbsoluteHttpUrl')

    // The active panel owns only the WebDAV entry button plus the always-mounted
    // dialog instance. No inline fields, actions, status, or last-sync text.
    expect(appSource).not.toContain('webdavAutoSync')
    expect(appSource).not.toContain('settings.webdavUrl')
    expect(appSource).not.toContain('settings.webdavUsername')
    expect(appSource).not.toContain('settings.webdavPassword')
    expect(appSource).not.toContain('settings.webdavPath')
    expect(appSource).not.toContain('handleWebdavTest')
    expect(appSource).not.toContain('handleWebdavUpload')
    expect(appSource).not.toContain('handleWebdavDownload')
    expect(appSource).not.toContain('webdavTesting')
    expect(appSource).not.toContain('webdavUploading')
    expect(appSource).not.toContain('webdavDownloading')
    expect(appSource).not.toContain('webdavStatusMessage')
    expect(appSource).not.toContain('webdavLastSyncText')
    expect(appSource).toContain('showWebdavSettingsDialog')
    expect(appSource).toContain('WebdavSettingsDialog.vue')
    expect(appSource).toContain(':visible="showWebdavSettingsDialog"')
    expect(appSource).toContain('@close="closeWebdavSettingsDialog"')
    expect(appSource).toContain('webdavSettingsButtonRef')

    expect(manifestSource).toContain('const CHROME_EXTENSION_KEY =')
    expect(manifestSource).toContain('if (!isFirefox)')
    expect(manifestSource).toContain('manifest.key = CHROME_EXTENSION_KEY')
  })

  it('renders an accessible manual WebDAV dialog with button-only primary entry', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const dialogSource = await readFile(resolve('src/contentScripts/views/WebdavSettingsDialog.vue'), 'utf8')
    const saveHandlerStart = dialogSource.indexOf('function handleSave()')
    const saveHandler = dialogSource.slice(
      saveHandlerStart,
      dialogSource.indexOf('async function handleTest()', saveHandlerStart),
    )
    const globalKeydownHandler = appSource.slice(
      appSource.indexOf('function handleGlobalKeydown'),
      appSource.indexOf('useEventListener(document, \'click\''),
    )

    // One localized button opens the dialog; the dialog is always mounted.
    expect(appSource).toContain('linux-do-settings-webdav-trigger')
    expect(appSource).toContain('openWebdavSettingsDialog')

    // The dialog owns the draft, save, validation, operation lock, and
    // confirmation semantics with accessible attributes and focus lifecycle.
    expect(dialogSource).toContain('defineProps')
    expect(dialogSource).toContain('visible: boolean')
    expect(dialogSource).toContain('defineEmits')
    expect(dialogSource).toContain('(event: \'close\')')
    expect(dialogSource).toContain('role="dialog"')
    expect(dialogSource).toContain('aria-modal="true"')
    expect(dialogSource).toContain('aria-labelledby')
    expect(dialogSource).toContain('interface Props')
    expect(dialogSource).toContain('const draft = ref(')
    expect(dialogSource).toContain('mergeWebdavFields')
    expect(dialogSource).toContain('validateSaveDraft')
    expect(dialogSource).toContain('validateTestDraft')
    expect(dialogSource).toContain('isDraftDirty')
    expect(dialogSource).toContain('isSavedConfigUsable')
    expect(dialogSource).toContain('downloadConfirmationVisible')
    expect(dialogSource).toContain('dialogSessionId')
    expect(dialogSource).toContain('activeOperation')
    expect(dialogSource).toMatch(/function handleSave\(\) \{\s+if \(isBusy\.value/)
    expect(dialogSource).toMatch(/async function handleTest\(\) \{\s+if \(isBusy\.value/)
    expect(dialogSource).toMatch(/:checked="draft\.webdavEnabled"[\s\S]{0,160}:disabled="isBusy"/)
    expect(dialogSource).toContain(':disabled="isBusy || downloadConfirmationVisible"')
    expect(dialogSource).toContain('role="group"')
    expect(dialogSource).toContain('webdavTestViaBackground')
    expect(dialogSource).toContain('uploadSettings')
    expect(dialogSource).toContain('downloadSettings')
    expect(dialogSource).toContain('closeDialog')
    expect(dialogSource).toContain('@click.self')
    expect(saveHandler).toContain('testResult.value = \'\'')
    expect(saveHandler).toContain('testResultSessionId = 0')

    // Modal keyboard behavior is owned by the app-level capture listener and
    // focus remains contained inside the Shadow DOM dialog.
    expect(globalKeydownHandler).toContain('if (showWebdavSettingsDialog.value)')
    expect(globalKeydownHandler).toContain('event.preventDefault()')
    expect(globalKeydownHandler).toContain('event.stopPropagation()')
    expect(globalKeydownHandler).toContain('event.stopImmediatePropagation()')
    expect(globalKeydownHandler).toContain('closeWebdavSettingsDialog()')
    expect(appSource).toContain('useEventListener(document, \'keydown\', handleGlobalKeydown, { capture: true })')
    expect(appSource).toContain(':inert="showWebdavSettingsDialog"')
    expect(dialogSource).toContain('const dialogRef = ref<HTMLElement | null>(null)')
    expect(dialogSource).toContain('function handleTabKeydown')
    expect(dialogSource).toContain('getRootNode()')
    expect(dialogSource).toContain('root instanceof ShadowRoot')
    expect(dialogSource).toContain('ref="dialogRef"')
    expect(dialogSource).toContain('@keydown.tab="handleTabKeydown"')
    expect(dialogSource).not.toContain('@keydown.escape="closeDialog"')
    expect(dialogSource).not.toContain('webdavAutoSync')
  })

  it('runs WebDAV network requests in the background to avoid content-script CORS', async () => {
    const webdavSource = await readFile(resolve('src/logic/webdav.ts'), 'utf8')
    const settingsSyncSource = await readFile(resolve('src/logic/settingsSync.ts'), 'utf8')
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const backgroundSource = await readFile(resolve('src/background/index.ts'), 'utf8')
    const webdavListenerSource = await readFile(resolve('src/background/messageListeners/webdav.ts'), 'utf8')
    const manifestSource = await readFile(resolve('src/manifest.ts'), 'utf8')

    // The content-script side must never call the raw fetch-based client directly;
    // it goes through the background via runtime messaging.
    expect(webdavSource).toContain('enum WEBDAV_MESSAGE')
    expect(webdavSource).toContain('browser.runtime.sendMessage')
    expect(webdavSource).toContain('export function webdavTestViaBackground')
    expect(webdavSource).toContain('export function webdavUploadViaBackground')
    expect(webdavSource).toContain('export function webdavDownloadViaBackground')

    expect(settingsSyncSource).toContain('webdavUploadViaBackground')
    expect(settingsSyncSource).toContain('webdavDownloadViaBackground')
    expect(settingsSyncSource).not.toMatch(/\bwebdavUpload\(/)
    expect(settingsSyncSource).not.toMatch(/\bwebdavDownload\(/)

    // Content-script App no longer touches WebDAV transports directly; the
    // dialog component owns the background test call.
    expect(appSource).not.toContain('webdavTestViaBackground')

    // The background wires up the WebDAV listener and performs the real fetch.
    expect(backgroundSource).toContain('setupWebdavMsgLstnrs')
    expect(webdavListenerSource).toContain('webdavTest')
    expect(webdavListenerSource).toContain('webdavUpload')
    expect(webdavListenerSource).toContain('webdavDownload')
    expect(webdavListenerSource).toContain('browser.runtime.onMessage.addListener')

    // Background must be allowed to reach arbitrary WebDAV origins.
    expect(manifestSource).toContain('\'<all_urls>\'')
  })

  it('renders the full-screen wrapper only when the iframe drawer is open', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const wrapperIdIndex = appSource.indexOf('id="bewly-wrapper"')
    const wrapperOpeningTag = appSource.slice(
      appSource.lastIndexOf('<div', wrapperIdIndex),
      appSource.indexOf('>', wrapperIdIndex) + 1,
    )

    expect(wrapperOpeningTag).toContain('<div')
    expect(wrapperOpeningTag).toContain('class="linux-do-drawer-root"')
    expect(wrapperOpeningTag).toContain('v-if="showIframeDrawer"')
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

  it('keeps top-level history handling in the content-script app, not the iframe drawer', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const drawerSource = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')

    expect(appSource).toMatch(/history\.(pushState|replaceState|back)/)
    expect(appSource).toContain('useEventListener(window, \'popstate\', handlePopState)')
    expect(drawerSource).not.toMatch(/history\.(pushState|replaceState|back)/)
    expect(drawerSource).not.toMatch(/closeDrawerWithoutPressingEscAgain|press_esc_again_to_close/)
    expect(drawerSource).not.toMatch(/copyLink|clipboard|Copy link|复制链接|複製連結/i)
    expect(drawerSource).not.toMatch(blockedLegacyTargets)
    expect(drawerSource).toContain('handleOpenInNewTab')
    expect(drawerSource).toContain('handleClose')
    expect(drawerSource).toContain('openLinkToNewTab(props.url)')
    expect(drawerSource).toContain(':src="props.url"')
    expect(drawerSource).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"')
    expect(drawerSource).toContain('addEventListener(\'keydown\', handleIframeKeydown)')
    expect(drawerSource).toContain('import { applyLinuxDoDrawerChrome } from \'~/sites/linuxDo\'')
    expect(drawerSource).toContain('applyLinuxDoDrawerChrome(iframeRef.value?.contentDocument)')
  })
})

describe('legacy settings tree deletion boundary', () => {
  const localeFiles = [
    'src/_locales/en.yml',
    'src/_locales/cmn-CN.yml',
    'src/_locales/cmn-TW.yml',
    'src/_locales/jyut.yml',
  ]

  it('does not keep the unmounted legacy Settings component tree', async () => {
    await expect(access(resolve('src/components/Settings'))).rejects.toThrow()
  })

  it.each(localeFiles)('removes the top-level settings: namespace from %s', async (localePath) => {
    const localeSource = await readFile(resolve(localePath), 'utf8')

    expect(localeSource).not.toMatch(/^settings:/m)
    // Shared namespaces adjacent to the deleted mapping must remain.
    expect(localeSource).toMatch(/^common:/m)
    expect(localeSource).toMatch(/^iframe_drawer:/m)
  })

  it('does not ignore the deleted tree in knip configuration', async () => {
    const knipSource = await readFile(resolve('knip.json'), 'utf8')
    const knipConfig = JSON.parse(knipSource) as { ignore?: string[] }

    expect(knipConfig.ignore ?? []).not.toContain('src/components/Settings/**')
    expect(knipConfig.ignore ?? []).toContain('src/inject/**')
  })
})
