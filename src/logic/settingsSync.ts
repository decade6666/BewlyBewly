import type { BlockedWordsState, Settings } from './storage'
import { blockedWords, originalSettings, settings } from './storage'
import type { WebDavConfig } from './webdav'
import {
  resolveWebdavDirectoryUrl,
  webdavDeleteViaBackground,
  webdavDownloadViaBackground,
  webdavListViaBackground,
  webdavUploadViaBackground,
} from './webdav'
import type { BackupListWarning, SettingsBackupSummary, WebDavDirectoryEntry } from './webdavBackups'
import {
  buildBackupFilename,
  buildRetentionPlan,
  MAX_BACKUP_NAME_ATTEMPTS,
  mergeVersionedWithLegacy,
  parseDirectoryListing,
} from './webdavBackups'
import { DEFAULT_WEBDAV_PATH, normalizeWebdavDirectoryPath } from './webdavSettings'

interface SyncEnvelope {
  version: 1
  timestamp: number
  settings: Partial<Settings>
  blockedWords: BlockedWordsState
}

interface SyncState {
  settings: Partial<Settings>
  blockedWords: BlockedWordsState
}

type SyncWarning = 'cleanup_partial'
type SyncErrorCode =
  | 'path_invalid'
  | 'directory_list_failed'
  | 'invalid_multistatus'
  | 'unsupported_href_format'
  | 'parse_error'
  | 'unsupported_version'
  | 'upload_collision_exhausted'
  | 'selected_backup_not_found'

type MissingDirectoryBehavior = 'empty' | 'error'

interface ParsedEnvelopeOk {
  ok: true
  envelope: SyncEnvelope
}
interface ParsedEnvelopeErr {
  ok: false
  error: 'parse_error' | 'unsupported_version'
}
type ParsedEnvelopeResult = ParsedEnvelopeOk | ParsedEnvelopeErr

interface ListDirectoryEntriesOk {
  ok: true
  entries: readonly WebDavDirectoryEntry[]
  directoryMissing: boolean
}
interface ListDirectoryEntriesErr {
  ok: false
  error: SyncErrorCode
}
type ListDirectoryEntriesResult = ListDirectoryEntriesOk | ListDirectoryEntriesErr

interface DownloadEnvelopeOk {
  ok: true
  envelope: SyncEnvelope
}
interface DownloadEnvelopeErr {
  ok: false
  error: 'remote_not_found' | SyncErrorCode | string
}
type DownloadEnvelopeResult = DownloadEnvelopeOk | DownloadEnvelopeErr

interface ScannedBackupsOk {
  ok: true
  backups: readonly SettingsBackupSummary[]
  warnings: readonly BackupListWarning[]
  nextLegacyFilePath: string
}
interface ScannedBackupsErr {
  ok: false
  error: SyncErrorCode
}
type ScannedBackupsResult = ScannedBackupsOk | ScannedBackupsErr

const WEBDAV_FIELDS: (keyof Settings)[] = [
  'webdavEnabled',
  'webdavUrl',
  'webdavUsername',
  'webdavPassword',
  'webdavPath',
  'webdavLastSyncTime',
  'webdavLegacyFilePath',
]

const WEBDAV_FIELD_SET = new Set<keyof Settings>(WEBDAV_FIELDS)

function stripWebdavFields(source: Settings): Partial<Settings> {
  return Object.fromEntries(
    (Object.keys(source) as (keyof Settings)[])
      .filter(key => !WEBDAV_FIELD_SET.has(key))
      .map(key => [key, source[key]]),
  ) as Partial<Settings>
}

function cloneBlockedWordsState(source: BlockedWordsState): BlockedWordsState {
  return {
    enabled: Boolean(source.enabled),
    words: Array.isArray(source.words) ? [...source.words] : [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBlockedWordsState(value: unknown): value is BlockedWordsState {
  return isRecord(value)
    && typeof value.enabled === 'boolean'
    && Array.isArray(value.words)
    && value.words.every(word => typeof word === 'string')
}

function isSyncEnvelope(value: unknown): value is SyncEnvelope {
  return isRecord(value)
    && value.version === 1
    && typeof value.timestamp === 'number'
    && Number.isFinite(value.timestamp)
    && isRecord(value.settings)
    && isBlockedWordsState(value.blockedWords)
}

function parseSyncEnvelopeText(text: string): ParsedEnvelopeResult {
  let parsedEnvelope: unknown
  try {
    parsedEnvelope = JSON.parse(text) as unknown
  }
  catch {
    return { ok: false, error: 'parse_error' }
  }

  if (!isRecord(parsedEnvelope))
    return { ok: false, error: 'parse_error' }

  if (parsedEnvelope.version !== 1)
    return { ok: false, error: 'unsupported_version' }

  if (!isSyncEnvelope(parsedEnvelope))
    return { ok: false, error: 'parse_error' }

  return { ok: true, envelope: parsedEnvelope }
}

function buildSyncState(): SyncState {
  return {
    settings: stripWebdavFields(settings.value),
    blockedWords: cloneBlockedWordsState(blockedWords.value),
  }
}

function getWebdavConfig(): WebDavConfig {
  return {
    url: settings.value.webdavUrl,
    username: settings.value.webdavUsername,
    password: settings.value.webdavPassword,
    path: settings.value.webdavPath || DEFAULT_WEBDAV_PATH,
  }
}

function getManagedDirectoryPath(path: string): string | null {
  const normalized = normalizeWebdavDirectoryPath(path)
  return normalized.ok ? normalized.path : null
}

function withConfigPath(config: WebDavConfig, path: string): WebDavConfig {
  return { ...config, path }
}

function buildManagedRequestPath(directoryPath: string, fileName: string): string {
  return directoryPath === '/'
    ? `/${fileName}`
    : `${directoryPath}${fileName}`
}

function updateLocalWebdavMetadata(patch: Partial<Pick<Settings, 'webdavLastSyncTime' | 'webdavLegacyFilePath'>>) {
  settings.value = { ...settings.value, ...patch }
}

function applyLegacyFilePath(nextLegacyFilePath: string) {
  if (settings.value.webdavLegacyFilePath === nextLegacyFilePath)
    return
  updateLocalWebdavMetadata({ webdavLegacyFilePath: nextLegacyFilePath })
}

async function listDirectoryEntries(
  config: WebDavConfig,
  missingDirectoryBehavior: MissingDirectoryBehavior,
): Promise<ListDirectoryEntriesResult> {
  const requestDirectoryPath = getManagedDirectoryPath(config.path)
  if (!requestDirectoryPath)
    return { ok: false, error: 'path_invalid' }

  const normalizedConfig = withConfigPath(config, requestDirectoryPath)
  const result = await webdavListViaBackground(normalizedConfig)

  if (!result.ok) {
    const isDirectoryMissing = result.status === 404 || result.error === 'not_found'
    if (isDirectoryMissing && missingDirectoryBehavior === 'empty')
      return { ok: true, entries: [], directoryMissing: true }
    return { ok: false, error: 'directory_list_failed' }
  }

  let directoryUrl: string
  try {
    directoryUrl = resolveWebdavDirectoryUrl(normalizedConfig)
  }
  catch {
    return { ok: false, error: 'path_invalid' }
  }

  const parsed = parseDirectoryListing({
    xml: result.data ?? '',
    directoryUrl,
    requestDirectoryPath,
  })

  if (!parsed.ok) {
    if (parsed.error === 'invalid_request_directory_path')
      return { ok: false, error: 'path_invalid' }
    return { ok: false, error: parsed.error }
  }

  return { ok: true, entries: parsed.entries, directoryMissing: false }
}

async function downloadEnvelopeAtPath(config: WebDavConfig, path: string): Promise<DownloadEnvelopeResult> {
  const result = await webdavDownloadViaBackground(withConfigPath(config, path))
  if (!result.ok) {
    if (result.status === 404 || result.error === 'not_found')
      return { ok: false, error: 'remote_not_found' }
    return { ok: false, error: result.error ?? 'download_failed' }
  }

  const parsed = parseSyncEnvelopeText(result.data ?? '')
  if (!parsed.ok)
    return parsed

  return { ok: true, envelope: parsed.envelope }
}

function findEntryByRequestPath(entries: readonly WebDavDirectoryEntry[], requestPath: string): WebDavDirectoryEntry | undefined {
  return entries.find(entry => !entry.isCollection && entry.requestPath === requestPath)
}

async function scanRemoteBackups(
  config: WebDavConfig,
  missingDirectoryBehavior: MissingDirectoryBehavior,
): Promise<ScannedBackupsResult> {
  const directoryEntries = await listDirectoryEntries(config, missingDirectoryBehavior)
  if (!directoryEntries.ok)
    return directoryEntries

  if (directoryEntries.directoryMissing) {
    return {
      ok: true,
      backups: [],
      warnings: [],
      nextLegacyFilePath: settings.value.webdavLegacyFilePath,
    }
  }

  const currentLegacyFilePath = settings.value.webdavLegacyFilePath
  const legacyEntry = currentLegacyFilePath.length > 0
    ? findEntryByRequestPath(directoryEntries.entries, currentLegacyFilePath)
    : undefined

  let mergeLegacyFilePath = ''
  let legacyTimestampMs: number | null = null
  let nextLegacyFilePath = currentLegacyFilePath

  if (currentLegacyFilePath.length > 0) {
    if (!legacyEntry) {
      nextLegacyFilePath = ''
    }
    else {
      const legacyResult = await downloadEnvelopeAtPath(config, currentLegacyFilePath)
      if (!legacyResult.ok) {
        if (legacyResult.error === 'remote_not_found') {
          nextLegacyFilePath = ''
        }
        else {
          mergeLegacyFilePath = currentLegacyFilePath
        }
      }
      else {
        mergeLegacyFilePath = currentLegacyFilePath
        legacyTimestampMs = legacyResult.envelope.timestamp
      }
    }
  }

  const merged = mergeVersionedWithLegacy({
    entries: directoryEntries.entries,
    legacyFilePath: mergeLegacyFilePath,
    legacyTimestampMs,
  })

  return {
    ok: true,
    backups: merged.backups,
    warnings: merged.warnings,
    nextLegacyFilePath,
  }
}

async function candidateAlreadyExists(config: WebDavConfig, candidatePath: string): Promise<boolean> {
  const directoryEntries = await listDirectoryEntries(config, 'empty')
  return directoryEntries.ok
    && directoryEntries.entries.some(entry => entry.requestPath === candidatePath)
}

function buildUploadFailureMessage(error: string | undefined, status: number): string {
  if (typeof error === 'string' && error.trim().length > 0)
    return error

  return status > 0
    ? `upload_failed_${status}`
    : 'upload_failed'
}

async function createVersionedBackup(
  config: WebDavConfig,
  payload: string,
  timestamp: number,
): Promise<{ ok: true, requestPath: string } | { ok: false, error: SyncErrorCode | string }> {
  const directoryPath = getManagedDirectoryPath(config.path)
  if (!directoryPath)
    return { ok: false, error: 'path_invalid' }

  for (let sequence = 1; sequence <= MAX_BACKUP_NAME_ATTEMPTS; sequence += 1) {
    const fileName = buildBackupFilename(timestamp, sequence)
    const requestPath = buildManagedRequestPath(directoryPath, fileName)
    const result = await webdavUploadViaBackground(withConfigPath(config, requestPath), payload, { createOnly: true })

    if (result.ok)
      return { ok: true, requestPath }

    if (result.status === 412)
      continue

    if (await candidateAlreadyExists(config, requestPath))
      continue

    return { ok: false, error: buildUploadFailureMessage(result.error, result.status) }
  }

  return { ok: false, error: 'upload_collision_exhausted' }
}

export interface BackupListResult {
  ok: boolean
  backups?: readonly SettingsBackupSummary[]
  warnings?: readonly BackupListWarning[]
  error?: SyncErrorCode | string
}

export interface SyncResult {
  ok: boolean
  warning?: SyncWarning
  error?: SyncErrorCode | string
}

export async function listSettingsBackups(): Promise<BackupListResult> {
  const config = getWebdavConfig()
  const scanned = await scanRemoteBackups(config, 'empty')
  if (!scanned.ok)
    return { ok: false, error: scanned.error }

  applyLegacyFilePath(scanned.nextLegacyFilePath)

  return {
    ok: true,
    backups: scanned.backups,
    ...(scanned.warnings.length > 0 ? { warnings: scanned.warnings } : {}),
  }
}

export async function uploadSettings(): Promise<SyncResult> {
  const config = getWebdavConfig()
  const syncState = buildSyncState()
  const envelope: SyncEnvelope = {
    version: 1,
    timestamp: Date.now(),
    settings: syncState.settings,
    blockedWords: syncState.blockedWords,
  }
  const uploadData = JSON.stringify(envelope, null, 2)
  const created = await createVersionedBackup(config, uploadData, envelope.timestamp)

  if (!created.ok)
    return { ok: false, error: created.error }

  updateLocalWebdavMetadata({ webdavLastSyncTime: envelope.timestamp })

  const scanned = await scanRemoteBackups(config, 'error')
  if (!scanned.ok)
    return { ok: true, warning: 'cleanup_partial' }

  let cleanupPartial = scanned.warnings.length > 0
  let nextLegacyFilePath = scanned.nextLegacyFilePath
  const retentionPlan = buildRetentionPlan(scanned.backups)

  for (const backup of retentionPlan.delete) {
    const deleteResult = await webdavDeleteViaBackground(withConfigPath(config, backup.requestPath))
    if (!deleteResult.ok) {
      cleanupPartial = true
      continue
    }

    if (backup.source === 'legacy')
      nextLegacyFilePath = ''
  }

  applyLegacyFilePath(nextLegacyFilePath)

  return cleanupPartial
    ? { ok: true, warning: 'cleanup_partial' }
    : { ok: true }
}

export async function downloadSettings(selectedPath?: string): Promise<SyncResult> {
  if (!selectedPath)
    return { ok: false, error: 'selected_backup_not_found' }

  const config = getWebdavConfig()
  const scanned = await scanRemoteBackups(config, 'empty')
  if (!scanned.ok)
    return { ok: false, error: scanned.error }

  const selectedBackup = scanned.backups.find(backup => backup.requestPath === selectedPath)
  if (!selectedBackup)
    return { ok: false, error: 'selected_backup_not_found' }

  const downloaded = await downloadEnvelopeAtPath(config, selectedBackup.requestPath)
  if (!downloaded.ok) {
    if (downloaded.error === 'remote_not_found')
      return { ok: false, error: 'selected_backup_not_found' }
    return { ok: false, error: downloaded.error }
  }

  applyLegacyFilePath(scanned.nextLegacyFilePath)
  settings.value = buildDownloadedSettings(downloaded.envelope)
  blockedWords.value = cloneBlockedWordsState(downloaded.envelope.blockedWords)

  return { ok: true }
}

/**
 * Build the downloaded settings result immutably from defaults, the remote
 * settings, the current retained local WebDAV configuration, and the remote
 * envelope timestamp as the last-sync time. Never mutates the envelope or
 * current settings; local WebDAV configuration, including the legacy locator,
 * is preserved across restores.
 */
function buildDownloadedSettings(envelope: SyncEnvelope): Settings {
  return {
    ...originalSettings,
    ...envelope.settings,
    ...retainedWebdavFields(),
    webdavLastSyncTime: envelope.timestamp,
  }
}

function retainedWebdavFields(): Pick<
  Settings,
  'webdavEnabled' | 'webdavUrl' | 'webdavUsername' | 'webdavPassword' | 'webdavPath' | 'webdavLegacyFilePath'
> {
  return {
    webdavEnabled: settings.value.webdavEnabled,
    webdavUrl: settings.value.webdavUrl,
    webdavUsername: settings.value.webdavUsername,
    webdavPassword: settings.value.webdavPassword,
    webdavPath: settings.value.webdavPath,
    webdavLegacyFilePath: settings.value.webdavLegacyFilePath,
  }
}
