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
  normalizeWebdavDirectoryPath,
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
  webdavPath: '/bewly/',
}

describe('webdavSettings draft copy', () => {
  it('creates a new object containing only retained WebDAV fields', () => {
    const source = makeSettings({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/custom/path/',
      theme: 'dark',
      language: 'en',
    })

    const draft = copyWebdavDraft(source)

    expect(draft).toEqual({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavUsername: 'user',
      webdavPassword: 'pass',
      webdavPath: '/custom/path/',
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

  it('normalizes an empty path into the default directory path', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '' })

    expect(normalized.webdavPath).toBe(DEFAULT_WEBDAV_PATH)
  })

  it('normalizes a whitespace-only path into the default directory path', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '   ' })

    expect(normalized.webdavPath).toBe(DEFAULT_WEBDAV_PATH)
  })

  it('normalizes a directory-shaped path so it keeps leading and trailing slashes', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: '/custom/path' })

    expect(normalized.webdavPath).toBe('/custom/path/')
  })

  it('normalizes a bare directory name into the canonical directory form', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: 'bewly' })

    expect(normalized.webdavPath).toBe('/bewly/')
  })

  it('preserves significant spaces inside nonblank directory path segments', () => {
    const normalized = normalizeDraft({ ...baseRetained, webdavPath: ' reports /Q1 2026 ' })

    expect(normalized.webdavPath).toBe('/ reports /Q1 2026 /')
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
      webdavPath: '/bewly/',
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

  it('rejects a saved config whose directory path is invalid even when the URL is valid', () => {
    expect(isSavedConfigUsable(makeSettings({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/bewly/../etc/',
    }))).toBe(false)
  })

  it('rejects a saved config whose directory path contains a lone surrogate', () => {
    expect(isSavedConfigUsable(makeSettings({
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: `/bewly/${'\uD83D'}/`,
    }))).toBe(false)
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

describe('webdavSettings directory path normalization', () => {
  it('exposes the default synced path as the directory `/bewly/`', () => {
    expect(DEFAULT_WEBDAV_PATH).toBe('/bewly/')
  })

  it.each([
    ['/bewly/', '/bewly/'],
    ['/bewly', '/bewly/'],
    ['bewly', '/bewly/'],
    ['bewly/', '/bewly/'],
    ['/custom/path/', '/custom/path/'],
    ['/custom/path', '/custom/path/'],
    ['custom/path', '/custom/path/'],
    ['/  /  ', '/  /  /'],
    ['', '/bewly/'],
    ['   ', '/bewly/'],
    ['/', '/'],
  ])('normalizes %p into %p without mutating input', (input, expected) => {
    const result = normalizeWebdavDirectoryPath(input)

    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.path).toBe(expected)
    // Immutability: the input string is primitive, but the helper must not
    // throw or rely on external mutation.
  })

  it('preserves significant leading and trailing spaces within a relative directory segment', () => {
    const result = normalizeWebdavDirectoryPath(' reports ')

    expect(result).toEqual({ ok: true, path: '/ reports /' })
  })

  it('rejects path segments that traverse outside the chosen directory', () => {
    expect(normalizeWebdavDirectoryPath('/bewly/../etc/')).toEqual({ ok: false, error: 'path_invalid' })
    expect(normalizeWebdavDirectoryPath('/bewly/./settings')).toEqual({ ok: false, error: 'path_invalid' })
    expect(normalizeWebdavDirectoryPath('..')).toEqual({ ok: false, error: 'path_invalid' })
  })

  it('rejects control characters in the directory path', () => {
    expect(normalizeWebdavDirectoryPath('/bewly/\x00/')).toEqual({ ok: false, error: 'path_invalid' })
    expect(normalizeWebdavDirectoryPath('/bewly/\x07/')).toEqual({ ok: false, error: 'path_invalid' })
    expect(normalizeWebdavDirectoryPath('/bewly/\x1F/')).toEqual({ ok: false, error: 'path_invalid' })
  })

  it('rejects path segments that cannot be safely encoded', () => {
    expect(normalizeWebdavDirectoryPath(`/bewly/${'\uD83D'}/`)).toEqual({ ok: false, error: 'path_invalid' })
  })

  it('returns a discriminated result and never mutates a shared input object', () => {
    const input = { path: '/bewly' } as { path: string }
    const result = normalizeWebdavDirectoryPath(input.path)

    expect(result).toEqual({ ok: true, path: '/bewly/' })
    expect(input.path).toBe('/bewly')
  })
})

describe('webdavSettings directory path validation on Save and Test', () => {
  const absoluteUrl = 'https://example.com/dav'
  const goodDirectory = '/bewly/'
  const traversalPath = '/bewly/../etc/'
  const controlCharPath = `/bewly/${'\x00'}/`

  it('rejects a Save with a path-traversal directory before any background call', () => {
    expect(validateSaveDraft({
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: absoluteUrl,
      webdavPath: traversalPath,
    })).toBe('path_invalid')
  })

  it('rejects a Save with a control-character directory', () => {
    expect(validateSaveDraft({
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: absoluteUrl,
      webdavPath: controlCharPath,
    })).toBe('path_invalid')
  })

  it('accepts a Save with a valid absolute URL and canonical directory path', () => {
    expect(validateSaveDraft({
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: absoluteUrl,
      webdavPath: goodDirectory,
    })).toBeNull()
  })

  it('still validates the URL first on Test, then the directory path', () => {
    expect(validateTestDraft({
      ...baseRetained,
      webdavEnabled: false,
      webdavUrl: '',
      webdavPath: traversalPath,
    })).toBe('url_required')
    expect(validateTestDraft({
      ...baseRetained,
      webdavEnabled: false,
      webdavUrl: absoluteUrl,
      webdavPath: traversalPath,
    })).toBe('path_invalid')
    expect(validateTestDraft({
      ...baseRetained,
      webdavEnabled: false,
      webdavUrl: absoluteUrl,
      webdavPath: goodDirectory,
    })).toBeNull()
  })
})

describe('webdavSettings legacy locator visibility and clearing', () => {
  it('does not surface the local-only legacy locator in a copied draft', () => {
    const source = makeSettings({ webdavLegacyFilePath: '/bewly/settings.json' })

    const draft = copyWebdavDraft(source)

    expect(draft).not.toHaveProperty('webdavLegacyFilePath')
  })

  it('clears the legacy locator when the saved directory no longer matches it', () => {
    const current = makeSettings({ webdavLegacyFilePath: '/bewly/settings.json' })
    const saved = mergeWebdavFields(current, {
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/custom/',
    })

    expect(saved.webdavLegacyFilePath).toBe('')
  })

  it('preserves a matching legacy locator when the saved directory still contains it', () => {
    const current = makeSettings({ webdavLegacyFilePath: '/bewly/settings.json' })
    const saved = mergeWebdavFields(current, {
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/bewly/',
    })

    expect(saved.webdavLegacyFilePath).toBe('/bewly/settings.json')
  })

  it('does not mutate the input current settings while merging', () => {
    const current = makeSettings({ webdavLegacyFilePath: '/bewly/settings.json' })

    mergeWebdavFields(current, {
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/custom/',
    })

    expect(current.webdavLegacyFilePath).toBe('/bewly/settings.json')
  })
})

describe('webdavSettings validation error contract surface', () => {
  it('exposes `path_invalid` as a validation error kind', () => {
    // The validation error union must include the new directory error so the
    // dialog can dispatch URL vs path field errors separately.
    const traversalError = validateSaveDraft({
      ...baseRetained,
      webdavEnabled: true,
      webdavUrl: 'https://example.com/dav',
      webdavPath: '/bewly/../etc/',
    })

    expect(traversalError).toBe('path_invalid')
  })
})
