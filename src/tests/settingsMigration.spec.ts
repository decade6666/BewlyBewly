import { describe, expect, it, vi } from 'vitest'

import {
  cleanLegacySettingsStorageValue,
  hasLegacySettingsFields,
  migrateWebdavLegacyPath,
  removeLegacySettingsFields,
} from '../logic/settingsMigration'
import { originalSettings } from '../logic/storage'

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: { get: async () => ({}), set: async () => undefined },
    sync: { get: async () => ({}), set: async () => undefined },
  },
  runtime: { sendMessage: async () => ({ ok: false }) },
}))

function withSettings(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return { ...originalSettings, ...overrides } as Record<string, unknown>
}

describe('settingsMigration legacy single-file path migration', () => {
  it('migrates the old default `/bewly/settings.json` into `/bewly/` and remembers the original path', () => {
    const result = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '/bewly/settings.json' })

    expect(result.webdavPath).toBe('/bewly/')
    expect(result.webdavLegacyFilePath).toBe('/bewly/settings.json')
  })

  it('migrates a custom single-file path into its parent directory', () => {
    const result = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '/custom/archive.json' })

    expect(result.webdavPath).toBe('/custom/')
    expect(result.webdavLegacyFilePath).toBe('/custom/archive.json')
  })

  it('migrates a relative single-file path into a root-relative directory', () => {
    const result = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: 'archive.json' })

    expect(result.webdavPath).toBe('/')
    expect(result.webdavLegacyFilePath).toBe('/archive.json')
  })

  it('preserves an already-directory path as a directory without recording a legacy file', () => {
    const result = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '/custom/' })

    expect(result.webdavPath).toBe('/custom/')
    expect(result.webdavLegacyFilePath).toBe('')
  })

  it('treats any nonblank bare name without a trailing slash as a legacy single-file path', () => {
    const result = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: 'custom' })

    expect(result.webdavPath).toBe('/')
    expect(result.webdavLegacyFilePath).toBe('/custom')
  })

  it('coerces a blank or missing path into the default directory', () => {
    const blank = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '' })
    const missing = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '   ' })

    expect(blank.webdavPath).toBe('/bewly/')
    expect(blank.webdavLegacyFilePath).toBe('')
    expect(missing.webdavPath).toBe('/bewly/')
    expect(missing.webdavLegacyFilePath).toBe('')
  })

  it('preserves an existing legacy locator when the path is already a directory that contains it', () => {
    const existing = {
      ...originalSettings,
      webdavPath: '/bewly/',
      webdavLegacyFilePath: '/bewly/settings.json',
    } as Record<string, unknown>

    const result = migrateWebdavLegacyPath(existing)

    expect(result.webdavLegacyFilePath).toBe('/bewly/settings.json')
  })

  it('is idempotent: running twice never re-truncates a directory or duplicates the locator', () => {
    const first = migrateWebdavLegacyPath({ ...originalSettings, webdavPath: '/bewly/settings.json' })
    const second = migrateWebdavLegacyPath(first)

    expect(second.webdavPath).toBe('/bewly/')
    expect(second.webdavLegacyFilePath).toBe('/bewly/settings.json')
  })

  it('never mutates the input settings object', () => {
    const input = { ...originalSettings, webdavPath: '/bewly/settings.json' }

    migrateWebdavLegacyPath(input)

    expect(input.webdavPath).toBe('/bewly/settings.json')
    expect(input.webdavLegacyFilePath).toBe('')
  })
})

describe('settingsMigration serialized and object storage form', () => {
  it('cleans a serialized JSON string by migrating the path and dropping legacy auto-sync keys', () => {
    const stored = JSON.stringify({
      ...originalSettings,
      webdavPath: '/bewly/settings.json',
      webdavAutoSync: true,
      webdavLocalModifiedTime: 999,
      hideHomePageGuidelineBanner: true,
    })

    const cleaned = cleanLegacySettingsStorageValue(stored) as string
    const parsed = JSON.parse(cleaned)

    expect(parsed.webdavPath).toBe('/bewly/')
    expect(parsed.webdavLegacyFilePath).toBe('/bewly/settings.json')
    expect(parsed.webdavAutoSync).toBeUndefined()
    expect(parsed.webdavLocalModifiedTime).toBeUndefined()
    expect(parsed.hideHomePageGuidelineBanner).toBeUndefined()
  })

  it('cleans an object-shaped stored value into a serialized JSON string for VueUse compatibility', () => {
    const stored = {
      ...originalSettings,
      webdavPath: '/bewly/settings.json',
      webdavAutoSync: true,
    }

    const result = cleanLegacySettingsStorageValue(stored)

    expect(typeof result).toBe('string')
    const parsed = JSON.parse(result as string)
    expect(parsed.webdavPath).toBe('/bewly/')
    expect(parsed.webdavLegacyFilePath).toBe('/bewly/settings.json')
    expect(parsed.webdavAutoSync).toBeUndefined()
  })

  it('passes through values that have no legacy fields and no legacy single-file path', () => {
    const clean = { ...originalSettings, webdavPath: '/bewly/' }

    expect(cleanLegacySettingsStorageValue(clean)).toBe(clean)
  })
})

describe('settingsMigration legacy-key surface still works', () => {
  it('detects legacy settings keys', () => {
    expect(hasLegacySettingsFields(withSettings({ webdavAutoSync: true }))).toBe(true)
    expect(hasLegacySettingsFields(withSettings({ webdavLocalModifiedTime: 1 }))).toBe(true)
    expect(hasLegacySettingsFields(withSettings({ hideHomePageGuidelineBanner: false }))).toBe(true)
  })

  it('removes legacy settings keys while preserving everything else', () => {
    const cleaned = removeLegacySettingsFields(withSettings({
      webdavAutoSync: true,
      hideHomePageGuidelineBanner: true,
      theme: 'dark',
    }))

    expect(cleaned).not.toHaveProperty('webdavAutoSync')
    expect(cleaned).not.toHaveProperty('hideHomePageGuidelineBanner')
    expect(cleaned.theme).toBe('dark')
  })

  it('drops the legacy guideline key while keeping the new community guidelines setting', () => {
    const cleaned = removeLegacySettingsFields(withSettings({
      hideHomePageGuidelineBanner: false,
      hideHomePageCommunityGuidelines: true,
      theme: 'light',
    }))

    expect(cleaned).not.toHaveProperty('hideHomePageGuidelineBanner')
    expect(cleaned.hideHomePageCommunityGuidelines).toBe(true)
    expect(cleaned.theme).toBe('light')
  })
})
