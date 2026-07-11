import type { Settings } from './storage'

export const DEFAULT_WEBDAV_PATH = '/bewly/settings.json'

export interface WebdavSettingsFields {
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
}

export type WebdavSettingsDraft = WebdavSettingsFields

export type WebdavValidationError = 'url_required' | 'url_invalid'

const WEBDAV_DRAFT_KEYS: readonly (keyof WebdavSettingsDraft)[] = [
  'webdavEnabled',
  'webdavUrl',
  'webdavUsername',
  'webdavPassword',
  'webdavPath',
]

/**
 * Recognize only absolute `http:` or `https:` URLs. Relative paths,
 * protocol-relative URLs, and non-network schemes (ftp, file, mailto,
 * javascript) are rejected before any credentials are sent.
 */
export function isAbsoluteHttpUrl(value: string): boolean {
  if (typeof value !== 'string')
    return false

  const candidate = value.trim()
  if (candidate.length === 0 || /\s/.test(candidate))
    return false

  try {
    const parsed = new URL(candidate)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

/**
 * Copy only the retained WebDAV fields from a full settings object into a new
 * draft. The draft is independent of its source and never carries unrelated
 * settings keys.
 */
export function copyWebdavDraft(source: Settings): WebdavSettingsDraft {
  return {
    webdavEnabled: source.webdavEnabled,
    webdavUrl: source.webdavUrl,
    webdavUsername: source.webdavUsername,
    webdavPassword: source.webdavPassword,
    webdavPath: source.webdavPath,
  }
}

/**
 * Normalize a draft for presentation and save: trim URL surrounding whitespace
 * (credentials are preserved exactly) and replace an empty/whitespace-only
 * path with the shared default path. Returns a new object; never mutates the
 * input.
 */
export function normalizeDraft(draft: WebdavSettingsDraft): WebdavSettingsDraft {
  const trimmedUrl = typeof draft.webdavUrl === 'string' ? draft.webdavUrl.trim() : ''
  const rawPath = typeof draft.webdavPath === 'string' ? draft.webdavPath : ''
  const normalizedPath = rawPath.trim().length > 0 ? rawPath : DEFAULT_WEBDAV_PATH

  return {
    webdavEnabled: draft.webdavEnabled,
    webdavUrl: trimmedUrl,
    webdavUsername: draft.webdavUsername,
    webdavPassword: draft.webdavPassword,
    webdavPath: normalizedPath,
  }
}

function validateUrlField(value: string): WebdavValidationError | null {
  const trimmed = value.trim()

  if (trimmed.length === 0)
    return 'url_required'

  return isAbsoluteHttpUrl(value) ? null : 'url_invalid'
}

/**
 * Validate a draft Save. An enabled draft requires an absolute HTTP(S) URL;
 * a disabled draft may save with no URL. Credentials are always optional.
 */
export function validateSaveDraft(draft: WebdavSettingsDraft): WebdavValidationError | null {
  if (!draft.webdavEnabled)
    return null

  return validateUrlField(draft.webdavUrl)
}

/**
 * Validate a draft Test. Testing uses the entered draft regardless of the
 * enabled switch, so it always requires an absolute HTTP(S) URL.
 */
export function validateTestDraft(draft: WebdavSettingsDraft): WebdavValidationError | null {
  return validateUrlField(draft.webdavUrl)
}

/**
 * Compare a draft against the currently persisted retained WebDAV fields.
 * Only changes to retained fields mark the draft dirty; unrelated current
 * settings changes do not.
 */
export function isDraftDirty(draft: WebdavSettingsDraft, persisted: Settings): boolean {
  return WEBDAV_DRAFT_KEYS.some(key => draft[key] !== persisted[key])
}

/**
 * A saved configuration is usable for manual transfers only when it is enabled
 * and the URL is an absolute HTTP(S) URL.
 */
export function isSavedConfigUsable(persisted: Settings): boolean {
  return Boolean(persisted.webdavEnabled) && isAbsoluteHttpUrl(persisted.webdavUrl)
}

/**
 * Immutably merge normalized retained WebDAV fields into the *current* full
 * settings object, not a snapshot captured when the dialog opened. This
 * preserves unrelated settings changed concurrently while Save was pending.
 * Returns a new object; never mutates the input.
 */
export function mergeWebdavFields(current: Settings, fields: WebdavSettingsDraft): Settings {
  return {
    ...current,
    webdavEnabled: fields.webdavEnabled,
    webdavUrl: fields.webdavUrl,
    webdavUsername: fields.webdavUsername,
    webdavPassword: fields.webdavPassword,
    webdavPath: fields.webdavPath,
  }
}
