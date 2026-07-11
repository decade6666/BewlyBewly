import type { BlockedWordsState, Settings } from './storage'
import { blockedWords, originalSettings, settings } from './storage'
import type { WebDavConfig } from './webdav'
import { webdavDownloadViaBackground, webdavUploadViaBackground } from './webdav'
import { DEFAULT_WEBDAV_PATH } from './webdavSettings'

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

const WEBDAV_FIELDS: (keyof Settings)[] = [
  'webdavEnabled',
  'webdavUrl',
  'webdavUsername',
  'webdavPassword',
  'webdavPath',
  'webdavLastSyncTime',
]

const WEBDAV_FIELD_SET = new Set<keyof Settings>(WEBDAV_FIELDS)

/** Local-only fields that must never be pushed to or pulled from the remote. */
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

export interface SyncResult {
  ok: boolean
  error?: string
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
  const result = await webdavUploadViaBackground(config, JSON.stringify(envelope, null, 2))
  if (result.ok)
    settings.value = { ...settings.value, webdavLastSyncTime: envelope.timestamp }
  return { ok: result.ok, error: result.error }
}

export async function downloadSettings(): Promise<SyncResult> {
  const config = getWebdavConfig()
  const result = await webdavDownloadViaBackground(config)

  if (!result.ok) {
    if (result.error === 'not_found')
      return { ok: false, error: 'remote_not_found' }
    return { ok: false, error: result.error }
  }

  let parsedEnvelope: unknown
  try {
    parsedEnvelope = JSON.parse(result.data!) as unknown
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

  settings.value = buildDownloadedSettings(parsedEnvelope)
  blockedWords.value = cloneBlockedWordsState(parsedEnvelope.blockedWords)

  return { ok: true }
}

/**
 * Build the downloaded settings result immutably from defaults, the remote
 * settings, the current retained local WebDAV configuration, and the remote
 * envelope timestamp as the last-sync time. Never mutates the envelope or
 * current settings; local-WebDAV configuration is preserved across downloads.
 */
function buildDownloadedSettings(envelope: SyncEnvelope): Settings {
  const merged: Settings = {
    ...originalSettings,
    ...envelope.settings,
    ...retainedWebdavFields(),
    webdavLastSyncTime: envelope.timestamp,
  }
  return merged
}

function retainedWebdavFields(): Pick<Settings, 'webdavEnabled' | 'webdavUrl' | 'webdavUsername' | 'webdavPassword' | 'webdavPath'> {
  return {
    webdavEnabled: settings.value.webdavEnabled,
    webdavUrl: settings.value.webdavUrl,
    webdavUsername: settings.value.webdavUsername,
    webdavPassword: settings.value.webdavPassword,
    webdavPath: settings.value.webdavPath,
  }
}
