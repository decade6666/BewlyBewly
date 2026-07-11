import type { Settings } from './storage'

export const DEFAULT_WEBDAV_PATH = '/bewly/'

export interface WebdavSettingsFields {
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
}

export type WebdavSettingsDraft = WebdavSettingsFields

export type WebdavValidationError = 'url_required' | 'url_invalid' | 'path_invalid'

const WEBDAV_DRAFT_KEYS: readonly (keyof WebdavSettingsDraft)[] = [
  'webdavEnabled',
  'webdavUrl',
  'webdavUsername',
  'webdavPassword',
  'webdavPath',
]

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1F)
      return true
  }
  return false
}

function isSafePathSegment(segment: string): boolean {
  if (segment === '.' || segment === '..')
    return false
  if (hasControlCharacters(segment))
    return false
  try {
    encodeURIComponent(segment)
    return true
  }
  catch {
    return false
  }
}

export interface WebdavDirectoryNormalizeOk {
  ok: true
  path: string
}
export interface WebdavDirectoryNormalizeErr {
  ok: false
  error: 'path_invalid'
}
export type WebdavDirectoryNormalizeResult = WebdavDirectoryNormalizeOk | WebdavDirectoryNormalizeErr

/**
 * Normalize a WebDAV sync directory path into a canonical logical form: a
 * leading `/`, no `.`/`..` segments, no control characters, and a trailing
 * `/`. Blank input falls back to the shared default directory. Returns a
 * discriminated result so callers can surface `path_invalid` before any
 * credential-bearing background request is sent.
 */
export function normalizeWebdavDirectoryPath(input: string): WebdavDirectoryNormalizeResult {
  const raw = typeof input === 'string' ? input : ''
  if (hasControlCharacters(raw))
    return { ok: false, error: 'path_invalid' }

  if (raw.trim().length === 0)
    return { ok: true, path: DEFAULT_WEBDAV_PATH }

  const normalizedLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  // Split on `/`; only truly empty segments from repeated slashes collapse to
  // nothing. Nonblank whitespace inside a segment is significant and must be
  // preserved so future request-path encoding can round-trip it exactly.
  const rawSegments = normalizedLeadingSlash.split('/').filter(segment => segment.length > 0)
  const compactSegments: string[] = []
  for (const segment of rawSegments) {
    if (!isSafePathSegment(segment))
      return { ok: false, error: 'path_invalid' }
    compactSegments.push(segment)
  }

  if (compactSegments.length === 0)
    return { ok: true, path: '/' }

  return { ok: true, path: `/${compactSegments.join('/')}/` }
}

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
 * settings keys, and it never surfaces the local-only legacy locator.
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
 * (credentials are preserved exactly) and coerce the directory path into the
 * canonical directory form — empty/whitespace paths fall back to the shared
 * default directory, and bare/missing trailing slashes are repaired. Directory
 * traversal/control-character inputs are intentionally preserved here so they
 * surface as `path_invalid` during Save/Test validation rather than being
 * silently rewritten. Returns a new object; never mutates the input.
 */
export function normalizeDraft(draft: WebdavSettingsDraft): WebdavSettingsDraft {
  const trimmedUrl = typeof draft.webdavUrl === 'string' ? draft.webdavUrl.trim() : ''
  const rawPath = typeof draft.webdavPath === 'string' ? draft.webdavPath : ''
  const normalized = normalizeWebdavDirectoryPath(rawPath)
  // Keep the path form produced by the directory normalizer. For invalid
  // paths, surface the literal input so validation can reject it cleanly
  // rather than silently rewriting a traversal/control path.
  const normalizedPath = normalized.ok ? normalized.path : rawPath

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

function validateDirectoryField(value: string): WebdavValidationError | null {
  const result = normalizeWebdavDirectoryPath(value)
  return result.ok ? null : result.error
}

/**
 * Validate a draft Save. An enabled draft requires an absolute HTTP(S) URL
 * and a well-formed directory path; a disabled draft may save with no URL.
 * Credentials are always optional. The URL is validated before the directory
 * so the user sees URL errors first when both fields are bad.
 */
export function validateSaveDraft(draft: WebdavSettingsDraft): WebdavValidationError | null {
  if (!draft.webdavEnabled)
    return null

  const urlError = validateUrlField(draft.webdavUrl)
  if (urlError)
    return urlError

  return validateDirectoryField(draft.webdavPath)
}

/**
 * Validate a draft Test. Testing uses the entered draft regardless of the
 * enabled switch, so it always requires an absolute HTTP(S) URL and a
 * well-formed directory path.
 */
export function validateTestDraft(draft: WebdavSettingsDraft): WebdavValidationError | null {
  const urlError = validateUrlField(draft.webdavUrl)
  if (urlError)
    return urlError

  return validateDirectoryField(draft.webdavPath)
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
  return Boolean(persisted.webdavEnabled)
    && isAbsoluteHttpUrl(persisted.webdavUrl)
    && normalizeWebdavDirectoryPath(persisted.webdavPath).ok
}

/**
 * Immutably merge normalized retained WebDAV fields into the *current* full
 * settings object, not a snapshot captured when the dialog opened. This
 * preserves unrelated settings changed concurrently while Save was pending.
 * The local-only `webdavLegacyFilePath` locator is cleared when the saved
 * directory no longer contains it, so a user choosing a different directory
 * cannot accidentally import the previous directory's legacy single-file
 * candidate into the new directory's list/rotation. Returns a new object;
 * never mutates the input.
 */
export function mergeWebdavFields(current: Settings, fields: WebdavSettingsDraft): Settings {
  const savedDirectory = normalizeWebdavDirectoryPath(fields.webdavPath)
  const savedDirectoryPath = savedDirectory.ok ? savedDirectory.path : fields.webdavPath
  const previousDirectory = normalizeWebdavDirectoryPath(current.webdavPath)
  const previousDirectoryPath = previousDirectory.ok ? previousDirectory.path : current.webdavPath

  const legacyLocator = current.webdavLegacyFilePath
  let nextLegacyLocator = legacyLocator
  if (savedDirectoryPath !== previousDirectoryPath)
    nextLegacyLocator = ''

  return {
    ...current,
    webdavEnabled: fields.webdavEnabled,
    webdavUrl: fields.webdavUrl,
    webdavUsername: fields.webdavUsername,
    webdavPassword: fields.webdavPassword,
    webdavPath: savedDirectoryPath,
    webdavLegacyFilePath: nextLegacyLocator,
  }
}
