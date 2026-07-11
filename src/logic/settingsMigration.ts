import { DEFAULT_WEBDAV_PATH } from './webdavSettings'

const LEGACY_SETTINGS_KEYS = ['hideHomePageGuidelineBanner', 'webdavAutoSync', 'webdavLocalModifiedTime'] as const

type LegacySettingKey = typeof LEGACY_SETTINGS_KEYS[number]

export function hasLegacySettingsFields(value: object): boolean {
  return LEGACY_SETTINGS_KEYS.some(key => Object.prototype.hasOwnProperty.call(value, key))
}

export function removeLegacySettingsFields<T extends object>(value: T): Omit<T, LegacySettingKey> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !isLegacySettingKey(key)),
  ) as Omit<T, LegacySettingKey>
}

export function cleanLegacySettingsStorageValue(value: unknown): unknown {
  if (typeof value === 'string')
    return cleanSerializedSettingsValue(value)

  if (isRecord(value) && (hasLegacySettingsFields(value) || needsWebdavLegacyMigration(value)))
    return JSON.stringify(cleanSettingsRecord(value))

  return value
}

function cleanSerializedSettingsValue(value: string): string {
  try {
    const parsedValue: unknown = JSON.parse(value)

    if (!isRecord(parsedValue))
      return value

    if (!hasLegacySettingsFields(parsedValue) && !needsWebdavLegacyMigration(parsedValue))
      return value

    return JSON.stringify(cleanSettingsRecord(parsedValue))
  }
  catch {
    return value
  }
}

function cleanSettingsRecord(value: Record<string, unknown>): Record<string, unknown> {
  return migrateWebdavLegacyPath(removeLegacySettingsFields(value))
}

function needsWebdavLegacyMigration(value: Record<string, unknown>): boolean {
  const path = value.webdavPath
  if (typeof path !== 'string')
    return false
  const trimmed = path.trim()
  if (trimmed.length === 0)
    return false
  // A directory path already ends with `/`; only legacy single-file paths
  // (no trailing slash) need migration. Values already carrying a locator
  // are handled idempotently inside `migrateWebdavLegacyPath`.
  return !trimmed.endsWith('/')
}

/**
 * Idempotently migrate a stored/local settings shape from the legacy
 * single-file `webdavPath` semantics to the directory semantics:
 *   `/bewly/settings.json` -> `webdavPath = '/bewly/'`,
 *   `webdavLegacyFilePath = '/bewly/settings.json'`.
 * Already-directory paths keep their directory semantics and never record a
 * legacy locator. The local-only `webdavLegacyFilePath` field is preserved
 * when the directory still contains it. Returns a new object; never mutates
 * the input.
 */
export function migrateWebdavLegacyPath<T extends object>(input: T): T {
  if (!isRecord(input))
    return input

  const existingPath = typeof input.webdavPath === 'string' ? input.webdavPath : ''
  const existingLegacy = typeof input.webdavLegacyFilePath === 'string' ? input.webdavLegacyFilePath : ''
  const trimmed = existingPath.trim()

  if (trimmed.length === 0) {
    // Blank/missing path -> default directory; keep any existing locator so
    // re-running the migration never erases a recorded legacy candidate.
    if (existingPath === DEFAULT_WEBDAV_PATH)
      return input
    return { ...input, webdavPath: DEFAULT_WEBDAV_PATH, webdavLegacyFilePath: existingLegacy } as T
  }

  if (trimmed.endsWith('/')) {
    // Already a directory: keep the path and any existing locator untouched.
    return input
  }

  // Legacy single-file path -> parent directory + locator recording the
  // original file path so it can still be listed/rotated after migration.
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const segments = normalized.split('/').filter(segment => segment.length > 0)
  const fileName = segments.length > 0 ? segments[segments.length - 1] : ''
  segments.pop()
  const directory = segments.length === 0 ? '/' : `/${segments.join('/')}/`
  const legacyFilePath = fileName.length > 0 ? normalized : ''

  return {
    ...input,
    webdavPath: directory,
    webdavLegacyFilePath: legacyFilePath,
  } as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLegacySettingKey(key: string): key is LegacySettingKey {
  return LEGACY_SETTINGS_KEYS.includes(key as LegacySettingKey)
}
