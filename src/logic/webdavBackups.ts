/**
 * Pure WebDAV versioned-backup helpers: managed filename generation/parsing,
 * RFC 4918 `Multi-Status` directory parsing, path/origin validation, legacy
 * single-file merging, and retention planning. This module is intentionally
 * free of network side effects and may run in the content-script DOM context
 * (it relies on `DOMParser`, available there but not in the MV3 background
 * service worker). The background transport layer must NOT import this file.
 */

export const BACKUP_FILE_PREFIX = 'bewly-settings-'
export const BACKUP_FILE_SUFFIX = '.json'
export const RETENTION_LIMIT = 20

/**
 * Maximum number of create-only upload attempts within the same UTC
 * millisecond (sequence `0001` through `0010`) before the upload fails
 * rather than degrading to an unconditional overwrite.
 */
export const MAX_BACKUP_NAME_ATTEMPTS = 10

const FILE_NAME_REGEX = /^bewly-settings-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z-(\d{4})\.json$/

const DAV_NS = 'DAV:'

/**
 * Minimal DAV property request set used for directory `PROPFIND Depth: 1`.
 * `resourcetype` distinguishes collections from files; `getlastmodified`
 * and `getcontentlength` are requested for diagnostics only and never
 * substitute for the version-1 envelope timestamp when ordering backups.
 */
export const DIRECTORY_PROPS_REQUEST = ['resourcetype', 'getlastmodified', 'getcontentlength'] as const

export interface WebDavDirectoryEntry {
  fileName: string
  requestPath: string
  isCollection: boolean
  lastModifiedMs?: number
  contentLength?: number
}

export type BackupSource = 'versioned' | 'legacy'

export interface SettingsBackupSummary {
  /** Stable identifier; the normalized requestPath. */
  id: string
  requestPath: string
  fileName: string
  source: BackupSource
  timestampMs: number
  sequence: number
}

export type BackupListWarning = 'legacy_unreadable'

export type ParseDirectoryError = 'invalid_multistatus' | 'unsupported_href_format' | 'invalid_request_directory_path'

export interface ParseDirectoryOk {
  ok: true
  entries: readonly WebDavDirectoryEntry[]
}
export interface ParseDirectoryErr {
  ok: false
  error: ParseDirectoryError
}
export type ParseDirectoryResult = ParseDirectoryOk | ParseDirectoryErr

export interface RetentionPlan {
  keep: readonly SettingsBackupSummary[]
  delete: readonly SettingsBackupSummary[]
}

interface ResolvedHref {
  isSelf: boolean
  isDirectory: boolean
  isDirectChild: boolean
  fileName: string
  requestPath: string
}

function containsUnsafeFileNameChar(fileName: string): boolean {
  for (let index = 0; index < fileName.length; index += 1) {
    const code = fileName.charCodeAt(index)
    if (isPathControlCode(code) || fileName[index] === '/' || fileName[index] === '\\')
      return true
  }
  return false
}

function isPathControlCode(code: number): boolean {
  return code <= 0x1F || code === 0x7F || (code >= 0x80 && code <= 0x9F)
}

function leadingZero(value: number, width: number): string {
  const text = value.toString()
  if (text.length >= width)
    return text
  return `${'0'.repeat(width - text.length)}${text}`
}

function asCanonicalDirectoryUrl(directoryUrl: string): { ok: false } | { ok: true, canonicalDirUrl: string, directoryPath: string } {
  let parsed: URL
  try {
    parsed = new URL(directoryUrl)
  }
  catch {
    return { ok: false }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return { ok: false }
  parsed.pathname = parsed.pathname.length > 0 ? parsed.pathname : '/'
  parsed.search = ''
  parsed.hash = ''
  return {
    ok: true,
    canonicalDirUrl: parsed.href,
    directoryPath: parsed.pathname,
  }
}

function asCanonicalDirectoryPath(path: string): string {
  const withTrailingSlash = asPathWithTrailingSlash(path)
  return withTrailingSlash === '//' ? '/' : withTrailingSlash
}

function decodeDirectChildFileName(encodedFileName: string): string | null {
  let fileName: string
  try {
    // DOMParser already decoded XML entities from the text node; URI
    // percent-decoding is a second, distinct layer applied only after the
    // path was validated as a direct child of the configured directory.
    fileName = decodeURIComponent(encodedFileName)
  }
  catch {
    return null
  }
  if (fileName.length === 0 || fileName === '.' || fileName === '..')
    return null
  if (containsUnsafeFileNameChar(fileName))
    return null
  try {
    encodeURIComponent(fileName)
  }
  catch {
    return null
  }
  return fileName
}

function buildRequestPath(directoryPath: string, fileName: string): string {
  const canonicalDirPath = asCanonicalDirectoryPath(directoryPath)
  return canonicalDirPath === '/'
    ? `/${fileName}`
    : `${canonicalDirPath}${fileName}`
}

function normalizeRequestDirectoryPath(path: string): string | null {
  if (typeof path !== 'string' || path.length === 0)
    return null
  if (!path.startsWith('/') || !path.endsWith('/'))
    return null

  const segments = path.split('/').filter(segment => segment.length > 0)
  for (const segment of segments) {
    if (segment === '.' || segment === '..')
      return null

    for (let index = 0; index < segment.length; index += 1) {
      if (isPathControlCode(segment.charCodeAt(index)))
        return null
    }

    try {
      encodeURIComponent(segment)
    }
    catch {
      return null
    }
  }

  return segments.length === 0 ? '/' : `/${segments.join('/')}/`
}

function resolveHref(
  rawHref: string,
  canonicalDirUrl: string,
  directoryPath: string,
  requestDirectoryPath: string,
): ResolvedHref | null {
  let parsed: URL
  try {
    parsed = new URL(rawHref, canonicalDirUrl)
  }
  catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return null

  const configOrigin = new URL(canonicalDirUrl)
  if (parsed.origin !== configOrigin.origin)
    return null

  const hrefPath = parsed.pathname
  const canonicalDirPath = asCanonicalDirectoryPath(directoryPath)
  const canonicalDirWithoutSlash = canonicalDirPath === '/' ? '/' : withoutTrailingSlash(canonicalDirPath)

  // Self: href matches the directory path (with or without trailing slash).
  if (hrefPath === canonicalDirPath || hrefPath === canonicalDirWithoutSlash)
    return { isSelf: true, isDirectory: true, isDirectChild: false, fileName: '', requestPath: hrefPath }

  // Reject sibling/adjacent-prefix directories that share only a path prefix.
  if (!hrefPath.startsWith(canonicalDirPath))
    return null

  const remainder = hrefPath.slice(canonicalDirPath.length)
  // Direct child = remainder is a single segment, no further slashes and no
  // empty trailing segment. A trailing slash indicates a sub-collection.
  if (remainder.endsWith('/'))
    return { isSelf: false, isDirectory: true, isDirectChild: false, fileName: remainder.slice(0, -1), requestPath: hrefPath }
  if (remainder.length === 0 || remainder.includes('/'))
    return null

  const fileName = decodeDirectChildFileName(remainder)
  if (!fileName)
    return null

  return {
    isSelf: false,
    isDirectory: false,
    isDirectChild: true,
    fileName,
    requestPath: buildRequestPath(requestDirectoryPath, fileName),
  }
}

function asPathWithTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}

function withoutTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

function getLocalName(node: Element): string {
  // Local name is namespace-aware; do not hardcode the `d:`/`D:` prefix.
  return node.localName || node.nodeName.replace(/^[^:]*:/, '')
}

function isDavElement(node: Element, localName: string): boolean {
  const ns = node.namespaceURI
  if (getLocalName(node) !== localName)
    return false
  // Prefer the canonical `DAV:` namespace; tolerate an empty/null namespace
  // for servers that omit the declaration or use a default namespace.
  return ns === DAV_NS || ns === null || ns === ''
}

function directChildren<T extends Element>(root: Element, localName: string): T[] {
  const out: T[] = []
  for (const child of Array.from(root.children) as Element[]) {
    if (isDavElement(child, localName))
      out.push(child as T)
  }
  return out
}

function readHref(responseElement: Element): string | null {
  const hrefs = directChildren(responseElement, 'href')
  if (hrefs.length === 0)
    return null
  const raw = hrefs[0].textContent
  if (typeof raw !== 'string' || raw.length === 0)
    return null
  return raw
}

function readResponseStatus(responseElement: Element): number | null {
  const status = directChildren(responseElement, 'status')[0]?.textContent
  if (!status)
    return null
  const match = /\bHTTP\/\d(?:\.\d)?\s+(\d{3})\b/.exec(status)
  return match ? Number(match[1]) : null
}

function collectPropstats(responseElement: Element): { resourcetypeIsCollection: boolean, lastModifiedMs?: number, contentLength?: number } {
  let resourcetypeIsCollection = false
  let lastModifiedMs: number | undefined
  let contentLength: number | undefined

  const propstats = directChildren(responseElement, 'propstat')
  for (const propstat of propstats) {
    const status = readResponseStatus(propstat)
    // Only consume properties whose propstat reports success; a 404 on
    // `getcontentlength` must not invalidate `resourcetype` or
    // `getlastmodified` from another successful propstat.
    if (status !== null && (status < 200 || status >= 300))
      continue

    const props = directChildren(propstat, 'prop')[0]
    if (!props)
      continue

    for (const prop of Array.from(props.children)) {
      if (isDavElement(prop, 'resourcetype')) {
        if (directChildren(prop, 'collection').length > 0)
          resourcetypeIsCollection = true
      }
      else if (isDavElement(prop, 'getlastmodified')) {
        const text = prop.textContent
        if (text) {
          const ms = Date.parse(text)
          if (Number.isFinite(ms))
            lastModifiedMs = ms
        }
      }
      else if (isDavElement(prop, 'getcontentlength')) {
        const text = prop.textContent
        if (text) {
          const n = Number(text)
          if (Number.isFinite(n))
            contentLength = n
        }
      }
    }
  }

  return { resourcetypeIsCollection, lastModifiedMs, contentLength }
}

/**
 * Detect a `parsererror` element produced by `DOMParser` when fed malformed
 * XML. Used to distinguish a non-XML body from a successful (but possibly
 * empty) multistatus response.
 */
export function detectXmlParseError(xml: string): boolean {
  if (typeof DOMParser === 'undefined')
    return false
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml')
  }
  catch {
    return true
  }
  return doc.getElementsByTagName('parsererror').length > 0
}

function parseMultistatusDoc(doc: Document): Element | null {
  const root = doc.documentElement
  if (!root)
    return null
  if (!isDavElement(root, 'multistatus'))
    return null
  return root
}

/**
 * Parse the body of a `PROPFIND Depth: 1` directory listing response into
 * validated direct-child entries. Skips the directory self entry and any
 * sub-directories, normalizes `href` forms (absolute URI or absolute path),
 * handles XML entity decoding plus URI percent-encoding separately, and
 * rejects cross-origin or non-direct-child hrefs. The server's response
 * ordering has no meaning; callers must sort the parsed entries themselves.
 */
export function parseDirectoryListing(input: {
  xml: string
  directoryUrl: string
  requestDirectoryPath: string
}): ParseDirectoryResult {
  const config = asCanonicalDirectoryUrl(input.directoryUrl)
  if (!config.ok)
    return { ok: false, error: 'invalid_multistatus' }
  const { canonicalDirUrl, directoryPath } = config
  const requestDirectoryPath = normalizeRequestDirectoryPath(input.requestDirectoryPath)
  if (!requestDirectoryPath)
    return { ok: false, error: 'invalid_request_directory_path' }

  if (detectXmlParseError(input.xml))
    return { ok: false, error: 'invalid_multistatus' }

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(input.xml, 'application/xml')
  }
  catch {
    return { ok: false, error: 'invalid_multistatus' }
  }

  const root = parseMultistatusDoc(doc)
  if (!root)
    return { ok: false, error: 'invalid_multistatus' }

  const entries: WebDavDirectoryEntry[] = []
  const responses = directChildren(root, 'response')
  for (const response of responses) {
    const rawHref = readHref(response)
    if (!rawHref)
      continue

    const resolved = resolveHref(rawHref, canonicalDirUrl, directoryPath, requestDirectoryPath)
    if (!resolved)
      return { ok: false, error: 'unsupported_href_format' }

    if (resolved.isSelf)
      continue
    if (resolved.isDirectory)
      continue
    if (!resolved.isDirectChild)
      return { ok: false, error: 'unsupported_href_format' }

    const resourceStatus = readResponseStatus(response)
    if (resourceStatus !== null && (resourceStatus < 200 || resourceStatus >= 300))
      continue

    const { resourcetypeIsCollection, lastModifiedMs, contentLength } = collectPropstats(response)
    if (resourcetypeIsCollection)
      continue

    entries.push({
      fileName: resolved.fileName,
      requestPath: resolved.requestPath,
      isCollection: false,
      lastModifiedMs,
      contentLength,
    })
  }

  return { ok: true, entries }
}

/**
 * Build a managed backup filename with a fixed prefix, a UTC millisecond
 * timestamp token (no colons), and a fixed-width collision sequence suffix.
 * The result is sortable, contains only ASCII-safe characters, and is safe
 * for WebDAV/file-system interoperation.
 */
export function buildBackupFilename(timestampMs: number, sequence: number): string {
  if (!Number.isFinite(timestampMs) || !Number.isInteger(timestampMs))
    throw new TypeError('timestampMs must be a finite integer')
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_BACKUP_NAME_ATTEMPTS)
    throw new TypeError(`sequence must be an integer between 1 and ${MAX_BACKUP_NAME_ATTEMPTS}`)

  const date = new Date(timestampMs)
  const token = `${date.getUTCFullYear()}`
    + `${leadingZero(date.getUTCMonth() + 1, 2)}${leadingZero(date.getUTCDate(), 2)}`
    + `T${leadingZero(date.getUTCHours(), 2)}${leadingZero(date.getUTCMinutes(), 2)}${leadingZero(date.getUTCSeconds(), 2)}`
    + `.${leadingZero(date.getUTCMilliseconds(), 3)}Z`

  return `${BACKUP_FILE_PREFIX}${token}-${leadingZero(sequence, 4)}${BACKUP_FILE_SUFFIX}`
}

/**
 * Parse the UTC millisecond timestamp from a managed backup filename. Uses
 * regex + `Date.UTC` rather than `Date.parse()` so auto-carrying dates
 * (e.g. February 31) are rejected, and re-formats the parsed token to verify
 * it matches the input byte-for-byte. Returns `null` for unrecognized names.
 */
export function parseTimestampFromFilename(fileName: string): number | null {
  const match = FILE_NAME_REGEX.exec(fileName)
  if (!match)
    return null

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, msText, seqText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const ms = Number(msText)
  const sequence = Number(seqText)
  if (sequence < 1 || sequence > MAX_BACKUP_NAME_ATTEMPTS)
    return null

  // Range checks: Date.UTC silently rolls over out-of-range values, so guard
  // explicitly to reject invalid calendar dates rather than auto-carry them.
  if (month < 1 || month > 12)
    return null
  if (day < 1 || day > 31)
    return null
  if (hour > 23 || minute > 59 || second > 59)
    return null

  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  if (!Number.isFinite(timestamp))
    return null

  // Re-format and require an exact match so invalid-but-rollover dates
  // (e.g. 2026-02-31) are rejected rather than silently accepted.
  if (buildBackupFilename(timestamp, sequence) !== fileName)
    return null

  return timestamp
}

/** Parse the trailing 4-digit sequence number from a managed backup filename. */
export function parseSequenceFromFilename(fileName: string): number | null {
  const match = FILE_NAME_REGEX.exec(fileName)
  if (!match)
    return null
  const sequence = Number(match[8])
  return Number.isInteger(sequence) && sequence >= 1 && sequence <= MAX_BACKUP_NAME_ATTEMPTS
    ? sequence
    : null
}

/**
 * Recognize a file as a managed versioned backup by its name. Non-managed
 * files in the backup directory are never counted toward the retention set
 * and never appear in restore lists.
 */
export function isManagedBackupFilename(fileName: string): boolean {
  return parseTimestampFromFilename(fileName) !== null
}

/**
 * Merge parsed directory entries with a known legacy single-file candidate
 * into a sorted backup summary list. Only managed versioned files and an
 * exact-path-matching legacy candidate are included; other files in the
 * directory are ignored. The legacy timestamp is supplied by the caller after
 * a separate GET/validation of its version-1 envelope — its `lastModified`
 * value is diagnostic only and never substitutes for the envelope timestamp.
 * Unknown-time legacy files are omitted and surfaced as `legacy_unreadable`.
 */
export function mergeVersionedWithLegacy(input: {
  entries: readonly WebDavDirectoryEntry[]
  legacyFilePath: string
  legacyTimestampMs: number | null
}): { backups: SettingsBackupSummary[], warnings: BackupListWarning[] } {
  const warnings: BackupListWarning[] = []
  const backups: SettingsBackupSummary[] = []

  for (const entry of input.entries) {
    if (entry.isCollection)
      continue
    if (!isManagedBackupFilename(entry.fileName))
      continue
    const timestampMs = parseTimestampFromFilename(entry.fileName)
    if (timestampMs === null)
      continue
    const sequence = parseSequenceFromFilename(entry.fileName) ?? 0
    backups.push({
      id: entry.requestPath,
      requestPath: entry.requestPath,
      fileName: entry.fileName,
      source: 'versioned',
      timestampMs,
      sequence,
    })
  }

  const normalizedLegacy = typeof input.legacyFilePath === 'string' && input.legacyFilePath.trim().length > 0
    ? input.legacyFilePath
    : ''

  if (normalizedLegacy.length > 0) {
    const legacyEntry = matchLegacyEntry(input.entries, normalizedLegacy)
    if (legacyEntry && input.legacyTimestampMs === null) {
      // Unknown/incompatible legacy timestamp: omit from ordering/deletion
      // and record a compatibility warning; healthy versioned backups remain.
      warnings.push('legacy_unreadable')
    }
    if (legacyEntry && input.legacyTimestampMs !== null) {
      backups.push({
        id: legacyEntry.requestPath,
        requestPath: legacyEntry.requestPath,
        fileName: legacyEntry.fileName,
        source: 'legacy',
        timestampMs: input.legacyTimestampMs,
        sequence: 0,
      })
    }
  }

  backups.sort(compareBackupsNewestFirst)
  return { backups, warnings }
}

function matchLegacyEntry(entries: readonly WebDavDirectoryEntry[], legacyFilePath: string): WebDavDirectoryEntry | undefined {
  // Match on the exact requestPath; legacy file path is the normalized
  // absolute request path stored during migration. Other JSON files in the
  // same directory are not legacy.
  const target = legacyFilePath
  return entries.find(entry => !entry.isCollection && entry.requestPath === target)
}

function compareBackupsNewestFirst(a: SettingsBackupSummary, b: SettingsBackupSummary): number {
  if (a.timestampMs !== b.timestampMs)
    return b.timestampMs - a.timestampMs
  // Same millisecond: higher sequence wins (was created later). Legacy has
  // sequence 0 and is placed after versioned entries of the same ms since
  // versioned entries are the only thing that can collide within a ms.
  if (a.sequence !== b.sequence)
    return b.sequence - a.sequence
  return a.requestPath.localeCompare(b.requestPath)
}

/**
 * Compute the retention plan for a set of backups: keep the newest
 * `RETENTION_LIMIT` items and mark every extra oldest item for deletion.
 * Input arrays are never mutated; the returned lists are new arrays. The
 * caller is expected to pass an already-sorted or unsorted input — sorting
 * is recomputed here so order assumptions cannot leak from upstream parsing.
 */
export function buildRetentionPlan(backups: readonly SettingsBackupSummary[]): RetentionPlan {
  const sorted = [...backups].sort(compareBackupsNewestFirst)
  const keep = sorted.slice(0, RETENTION_LIMIT)
  const toDelete = [...sorted.slice(RETENTION_LIMIT)].reverse()
  return {
    keep,
    delete: toDelete,
  }
}
