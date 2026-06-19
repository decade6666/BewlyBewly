import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import pkg from '../../package.json'
import { cleanLegacySettingsStorageValue, removeLegacySettingsFields } from '../logic/settingsMigration'
import { formatManifestVersion, getManifest } from '../manifest'
import {
  applyLinuxDoDrawerChrome,
  findLinuxDoTopicLink,
  hideLinuxDoHomePageElements,
  isLinuxDoHomePage,
  isLinuxDoTopicListPage,
  normalizeLinuxDoTopicUrl,
  renderLinuxDoHomePageTopicTags,
} from '../sites/linuxDo'

const blockedLegacyTargets = /bilibili|hdslb/i

describe('linux.do migration manifest and package metadata', () => {
  it('targets Linux.do only in the extension manifest', async () => {
    const manifest = await getManifest()
    const contentScriptMatches = manifest.content_scripts?.flatMap(script => script.matches ?? []) ?? []
    const serializedManifest = JSON.stringify(manifest)

    const contentScript = manifest.content_scripts?.[0]

    expect(manifest.name).toMatch(/^BewlyLinuxDo(?: Dev)?$/)
    expect(manifest.version).toBe('0.1.5')
    expect(manifest.description).toBe(
      'Focused drawer browsing and homepage content filtering for Linux.do.',
    )
    expect(manifest.homepage_url).toBe('https://github.com/decade6666/BewlyLinuxDo')
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

  it('formats the semver package version for the WebExtension manifest', () => {
    expect(formatManifestVersion(pkg.version)).toBe('0.1.5')
    expect(formatManifestVersion('0.1.2')).toBe('0.1.2')
  })

  it('uses Linux.do for local extension launch metadata', () => {
    expect(pkg.name).toBe('bewly-linux-do')
    expect(pkg.displayName).toBe('BewlyLinuxDo')
    expect(pkg.version).toBe('0.1.5')
    expect(pkg.description).toBe(
      'Focused drawer browsing and homepage content filtering for Linux.do.',
    )
    expect(pkg.description).toMatch(/linux\.do/i)
    expect(pkg.description).not.toMatch(blockedLegacyTargets)
    expect(pkg.homepage).toBe('https://github.com/decade6666/BewlyLinuxDo')
    expect(pkg.webExt.run.startUrl).toEqual(['https://linux.do/'])
  })

  it('shows the v0.1 Linux.do plugin UI description in About', async () => {
    const aboutSource = await readFile(resolve('src/components/Settings/About/About.vue'), 'utf8')

    expect(pkg.version.replace(/^(\d+\.\d+)\.0$/, '$1')).toBe('0.1.5')
    expect(aboutSource).toContain(
      'const displayVersion = version.replace(/^(\\d+\\.\\d+)\\.0$/, \'$1\')',
    )
    expect(aboutSource).toContain(
      'v{{ displayVersion }} - 面向 Linux.do 的专注抽屉浏览与首页内容过滤体验。',
    )
    expect(aboutSource).toContain('<span>BewlyLinuxDo</span>')
    expect(aboutSource).not.toContain('Farewell')
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

  it('cleans object-shaped browser-local settings values as serialized VueUse storage values', () => {
    const legacySettings = {
      hideHomePageGuidelineBanner: true,
      hideHomePagePinnedTopics: false,
      theme: 'dark',
    }

    expect(cleanLegacySettingsStorageValue(legacySettings)).toBe(JSON.stringify({
      hideHomePagePinnedTopics: false,
      theme: 'dark',
    }))
  })

  it('cleans serialized browser-local settings values', () => {
    const serializedSettings = JSON.stringify({
      hideHomePageGuidelineBanner: true,
      hideHomePagePinnedTopics: false,
      theme: 'dark',
    })

    expect(cleanLegacySettingsStorageValue(serializedSettings)).toBe(JSON.stringify({
      hideHomePagePinnedTopics: false,
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

describe('linux.do content script and drawer boundaries', () => {
  it('keeps the content script free of Bilibili DOM assumptions', async () => {
    const entrySource = await readFile(resolve('src/contentScripts/index.ts'), 'utf8')
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const drawerSource = await readFile(resolve('src/components/IframeDrawer.vue'), 'utf8')
    const source = `${entrySource}\n${appSource}\n${drawerSource}`

    expect(entrySource).toContain('import browser from \'webextension-polyfill\'')
    expect(entrySource).toContain('import { LINUX_DO_DRAWER_ROUTE_CHANGE } from \'~/constants/globalEvents\'')
    expect(entrySource).toContain('import { settings } from \'~/logic\'')
    expect(entrySource).toContain('return !isInIframe()')
    expect(entrySource).toContain('hideLinuxDoHomePageElements(document, cleanupUrl, {')
    expect(entrySource).toContain('renderLinuxDoHomePageTopicTags(document, cleanupUrl, settings.value.showHomePageTopicTags)')
    expect(entrySource).toContain('hidePinnedTopics: settings.value.hideHomePagePinnedTopics')
    expect(entrySource).toContain('enableBlockedWords: settings.value.enableHomePageBlockedWords')
    expect(entrySource).toContain('blockedWords: [...settings.value.homePageBlockedWords]')
    expect(entrySource).not.toContain('hideGuidelineBanner')
    expect(entrySource).not.toContain('hideHomePageGuidelineBanner')
    expect(entrySource).toContain('observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })')
    expect(entrySource).toContain('watch(')
    expect(entrySource).toContain('settings.value.hideHomePagePinnedTopics')
    expect(entrySource).toContain('settings.value.showHomePageTopicTags')
    expect(entrySource).toContain('settings.value.enableHomePageBlockedWords')
    expect(entrySource).toContain('...settings.value.homePageBlockedWords')
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
    expect(appSource).toContain('settings.enableHomePageBlockedWords')
    expect(appSource).toContain('settings.homePageBlockedWords')
    expect(appSource).toContain('handleBlockedWordsImport')
    expect(appSource).toContain('handleBlockedWordsExport')
    expect(appSource).not.toMatch(/hideGuidelineBanner|hideHomePageGuidelineBanner|Hide homepage guideline banner|隐藏首页社区准则横幅/)
    expect(appSource).toContain('import IframeDrawer from \'~/components/IframeDrawer.vue\'')
    expect(drawerSource).toContain('import Button from \'~/components/Button.vue\'')
    expect(source).not.toMatch(blockedLegacyTargets)
    expect(source).not.toMatch(/bili-header|home-redesign-base|bilibili-gate-root/i)
  })

  it('removes guideline banner controls, locale keys, and settings defaults', async () => {
    const homeSettingsSource = await readFile(resolve('src/components/Settings/BewlyPages/Home/Home.vue'), 'utf8')
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const storageSource = await readFile(resolve('src/logic/storage.ts'), 'utf8')
    const migrationSource = await readFile(resolve('src/logic/settingsMigration.ts'), 'utf8')
    const enLocaleSource = await readFile(resolve('src/_locales/en.yml'), 'utf8')
    const cmnCNLocaleSource = await readFile(resolve('src/_locales/cmn-CN.yml'), 'utf8')

    expect(homeSettingsSource).not.toMatch(/hide_homepage_guideline_banner|hideHomePageGuidelineBanner/)
    expect(appSource).not.toMatch(/hideGuidelineBanner|hideHomePageGuidelineBanner|Hide homepage guideline banner|隐藏首页社区准则横幅/)
    expect(storageSource).not.toContain('hideHomePageGuidelineBanner')
    expect(storageSource).toContain('showHomePageTopicTags: boolean')
    expect(storageSource).toContain('enableHomePageBlockedWords: boolean')
    expect(storageSource).toContain('homePageBlockedWords: string[]')
    expect(storageSource).toContain('showHomePageTopicTags: true')
    expect(storageSource).toContain('enableHomePageBlockedWords: false')
    expect(storageSource).toContain('homePageBlockedWords: []')
    expect(storageSource).toContain('void cleanupLegacySettingsStorage()')
    expect(storageSource).toContain('cleanLegacySettingsStorageValue(storedSettings)')
    expect(migrationSource).toContain('const LEGACY_SETTINGS_KEYS = [\'hideHomePageGuidelineBanner\'] as const')
    expect(enLocaleSource).not.toContain('hide_homepage_guideline_banner')
    expect(cmnCNLocaleSource).not.toContain('hide_homepage_guideline_banner')
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
    expect(drawerSource).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"')
    expect(drawerSource).toContain('addEventListener(\'keydown\', handleIframeKeydown)')
    expect(drawerSource).toContain('import { applyLinuxDoDrawerChrome } from \'~/sites/linuxDo\'')
    expect(drawerSource).toContain('applyLinuxDoDrawerChrome(iframeRef.value?.contentDocument)')
  })
})
