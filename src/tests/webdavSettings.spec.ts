import { describe, expect, it, vi } from 'vitest'

import type { Settings } from '../logic/storage'
import { originalSettings } from '../logic/storage'
import {
  copyWebdavDraft,
  DEFAULT_WEBDAV_PATH,
  isAbsoluteHttpUrl,
  isDraftDirty,
  isSavedConfigUsable,
  mergeWebdavFields,
  normalizeDraft,
  validateSaveDraft,
  validateTestDraft,
} from '../logic/webdavSettings'

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: { get: async () => ({}), set: async () => undefined },
    sync: { get: async () => ({}), set: async () => undefined },
  },
  runtime: { sendMessage: async () => ({ ok: false }) },
}))

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...originalSettings, ...overrides }
}

const baseRetained = {
  webdavEnabled: false,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: '/bewly/settings.json',
}

describe('webdavSettings draft copy', () => {
  it('creates a new object containing only retained WebDAV fields', () => {
    const source = makeSettings({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/custom/path.json',
      theme: 'dark',
      language: 'en',
    })

    const draft = copyWebdavDraft(source)

    expect(draft).toEqual({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/custom/path.json',
    })
    expect(draft).not.toHaveProperty('theme')
    expect(draft).not.toHaveProperty('language')
  })

  it('returns an independent object that does not mutate its source', () => {
    const source = makeSettings({ webdavUrl: 'https://a.example/dav' })
    const draft = copyWebdavDraft(source)
    const changedDraft = { ...draft, webdavUrl: 'https://b.example/dav' }

    expect(changedDraft.webdavUrl).toBe('https://b.example/dav')
    expect(source.webdavUrl).toBe('https://a.example/dav')
  })
})

describe('webdavSettings absolute HTTP(S) detection', () => {
  it.each([
    'https://example.com/dav',
    'http://example.com/dav',
    'https://linux.do/',
  ])('accepts %s as an absolute HTTP(S) URL', (url) => {
    expect(isAbsoluteHttpUrl(url)).toBe(true)
  })

  it.each([
    '',
    '   ',
    'example.com/dav',
    '//example.com/dav',
    'ftp://example.com/dav',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'mailto:test@example.com',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAbsoluteHttpUrl(url)).toBe(false)
  })
})

describe('webdavSettings normalizeDraft', () => {
  it('trims surrounding URL whitespace and preserves credentials exactly', () => {
    const normalized = normalizeDraft({
      webdavEnabled: true,
      webdavUrl: '  https://example.com/dav  ',
      webdavUsername: '  user  ',
      webdavPassword: '  pass word  ',
      webdavPath: '/bewly/settings.json',
    })

    expect(normalized.webdavUrl).toBe('https://example.com/dav')
    expect(normalized.webdavUsername).toBe('  user  ')
    expect(normalized.webdavPassword).toBe('  pass word  ')
  })

  it('replaces an empty path with the default path', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '' })

    expect(normalized.webdavPath).toBe(DEFAULT_WEBDAV_PATH)
  })

  it('replaces a whitespace-only path with the default path', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '   ' })

    expect(normalized.webdavPath).toBe(DEFAULT_WEBDAV_PATH)
  })

  it('preserves a non-empty custom path', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '/custom/path.json' })

    expect(normalized.webdavPath).toBe('/custom/path.json')
  })

  it('returns a new object without mutating the input', () => {
    const draft = { ...baseRetained, webdavPath: '' }

    normalizeDraft(draft)

    expect(draft.webdavPath).toBe('')
  })
})

describe('webdavSettings validateSaveDraft', () => {
  it('rejects an enabled draft with a missing URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: '' })).toBe('url_required')
  })

  it('rejects an enabled draft with a relative URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: 'example.com/dav' })).toBe('url_invalid')
  })

  it('rejects an enabled draft with a non-HTTP(S) URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: 'ftp://example.com/dav' })).toBe('url_invalid')
  })

  it('rejects an enabled draft with a malformed URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: 'https://' })).toBe('url_invalid')
  })

  it('accepts a disabled draft with an empty URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: false, webdavUrl: '' })).toBeNull()
  })

  it('accepts an enabled draft with an absolute HTTP(S) URL', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: 'https://example.com/dav' })).toBeNull()
  })

  it('trims the URL before validating', () => {
    expect(validateSaveDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: '  https://example.com/dav  ' })).toBeNull()
  })
})

describe('webdavSettings validateTestDraft', () => {
  it('requires an absolute HTTP(S) URL even when the draft is disabled', () => {
    expect(validateTestDraft({ ...baseRetained, webdavEnabled: false, webdavUrl: '' })).toBe('url_required')
  })

  it('rejects a non-HTTP(S) URL regardless of the enabled switch', () => {
    expect(validateTestDraft({ ...baseRetained, webdavEnabled: false, webdavUrl: 'ftp://example.com/dav' })).toBe('url_invalid')
  })

  it('accepts an absolute HTTP(S) URL regardless of the enabled switch', () => {
    expect(validateTestDraft({ ...baseRetained, webdavEnabled: false, webdavUrl: 'https://example.com/dav' })).toBeNull()
    expect(validateTestDraft({ ...baseRetained, webdavEnabled: true, webdavUrl: 'http://example.com/dav' })).toBeNull()
  })
})

describe('webdavSettings isDraftDirty', () => {
  it('is clean when the draft matches persisted retained fields', () => {
    const source = makeSettings({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/bewly/settings.json',
    })

    const draft = copyWebdavDraft(source)

    expect(isDraftDirty(draft, source)).toBe(false)
  })

  it('is dirty when a retained field changes', () => {
    const source = makeSettings({ webdavEnabled: false })
    const draft = {
      ...copyWebdavDraft(source),
      webdavEnabled: true,
    }

    expect(isDraftDirty(draft, source)).toBe(true)
  })

  it('is clean when only unrelated settings differ', () => {
    const source = makeSettings({ theme: 'light' })
    const draft = copyWebdavDraft(source)

    expect(isDraftDirty(draft, makeSettings({ theme: 'dark' }))).toBe(false)
  })
})

describe('webdavSettings isSavedConfigUsable', () => {
  it('requires the enabled switch plus an absolute HTTP(S) URL', () => {
    expect(isSavedConfigUsable(makeSettings({ webdavEnabled: false, webdavUrl: 'https://example.com/dav' }))).toBe(false)
    expect(isSavedConfigUsable(makeSettings({ webdavEnabled: true, webdavUrl: '' }))).toBe(false)
    expect(isSavedConfigUsable(makeSettings({ webdavEnabled: true, webdavUrl: 'ftp://example.com/dav' }))).toBe(false)
    expect(isSavedConfigUsable(makeSettings({ webdavEnabled: true, webdavUrl: 'https://example.com/dav' }))).toBe(true)
  })
})

describe('webdavSettings mergeWebdavFields', () => {
  it('returns a new full settings object with only retained WebDAV fields replaced', () => {
    const current = makeSettings({ theme: 'dark', language: 'zh', webdavEnabled: false, webdavUrl: '' })

    const merged = mergeWebdavFields(current, {
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: DEFAULT_WEBDAV_PATH,
    })

    expect(merged).not.toBe(current)
    expect(merged.theme).toBe('dark')
    expect(merged.language).toBe('zh')
    expect(merged.webdavEnabled).toBe(true)
    expect(merged.webdavUrl).toBe('https://example.com/dav')
    expect(merged.webdavPath).toBe(DEFAULT_WEBDAV_PATH)
  })

  it('preserves unrelated concurrent settings changes made after the dialog opened', () => {
    const openedSnapshot = makeSettings({ theme: 'light' })
    const current = makeSettings({ theme: 'dark', webdavEnabled: false })

    const merged = mergeWebdavFields(current, { ...copyWebdavDraft(openedSnapshot), webdavEnabled: true })

    expect(merged.theme).toBe('dark')
    expect(merged.webdavEnabled).toBe(true)
  })
})
