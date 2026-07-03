import type { Settings } from './storage'
import { originalSettings, settings } from './storage'
import type { WebDavConfig } from './webdav'
import { webdavDownload, webdavUpload } from './webdav'

interface SyncEnvelope {
  version: 1
  timestamp: number
  settings: Partial<Settings>
}

const WEBDAV_FIELDS: (keyof Settings)[] = [
  'webdavEnabled',
  'webdavUrl',
  'webdavUsername',
  'webdavPassword',
  'webdavPath',
  'webdavAutoSync',
  'webdavLastSyncTime',
  'webdavLocalModifiedTime',
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

function getWebdavConfig(): WebDavConfig {
  return {
    url: settings.value.webdavUrl,
    username: settings.value.webdavUsername,
    password: settings.value.webdavPassword,
    path: settings.value.webdavPath || '/bewly/settings.json',
  }
}

export interface SyncResult {
  ok: boolean
  error?: string
  skipped?: boolean
}

/** Guards the auto-upload watcher from firing while a remote snapshot is being applied. */
let applyingRemote = false
let lastSyncedSnapshot: string | null = null

export async function uploadSettings(): Promise<SyncResult> {
  const config = getWebdavConfig()
  const envelope: SyncEnvelope = {
    version: 1,
    timestamp: Date.now(),
    settings: stripWebdavFields(settings.value),
  }
  const result = await webdavUpload(config, JSON.stringify(envelope, null, 2))
  if (result.ok) {
    lastSyncedSnapshot = JSON.stringify(envelope.settings)
    settings.value.webdavLastSyncTime = envelope.timestamp
  }
  return { ok: result.ok, error: result.error }
}

export async function downloadSettings(options: { onlyIfNewer?: boolean } = {}): Promise<SyncResult> {
  const config = getWebdavConfig()
  const result = await webdavDownload(config)

  if (!result.ok) {
    if (result.error === 'not_found')
      return { ok: false, error: 'remote_not_found' }
    return { ok: false, error: result.error }
  }

  let envelope: SyncEnvelope
  try {
    envelope = JSON.parse(result.data!) as SyncEnvelope
  }
  catch {
    return { ok: false, error: 'parse_error' }
  }

  if (envelope.version !== 1)
    return { ok: false, error: 'unsupported_version' }

  // Auto-sync path: skip applying an older/equal remote snapshot to avoid
  // clobbering newer local changes across multiple tabs.
  if (options.onlyIfNewer && envelope.timestamp <= settings.value.webdavLastSyncTime)
    return { ok: true, skipped: true }

  applyingRemote = true
  try {
    const merged = { ...originalSettings, ...envelope.settings } as Settings
    // Preserve local-only WebDAV config; never overwrite it from the remote.
    for (const key of WEBDAV_FIELDS)
      (merged[key] as Settings[typeof key]) = settings.value[key]
    settings.value = merged
    settings.value.webdavLastSyncTime = envelope.timestamp
    settings.value.webdavLocalModifiedTime = 0
    lastSyncedSnapshot = JSON.stringify(stripWebdavFields(settings.value))
  }
  finally {
    applyingRemote = false
  }

  return { ok: true }
}

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null
let autoSyncUnwatch: (() => void) | null = null

export function setupAutoSync(watchFn: typeof import('vue').watch): void {
  if (autoSyncUnwatch) {
    autoSyncUnwatch()
    autoSyncUnwatch = null
  }

  autoSyncUnwatch = watchFn(
    () => stripWebdavFields(settings.value),
    (newVal) => {
      const currentSnapshot = JSON.stringify(newVal)
      if (currentSnapshot === lastSyncedSnapshot)
        return
      if (applyingRemote)
        return
      if (!settings.value.webdavEnabled || !settings.value.webdavAutoSync || !settings.value.webdavUrl)
        return

      settings.value.webdavLocalModifiedTime = Date.now()

      if (autoSyncTimer)
        clearTimeout(autoSyncTimer)
      autoSyncTimer = setTimeout(() => {
        uploadSettings().catch(console.error)
      }, 2000)
    },
    { deep: true },
  )
}

export async function autoDownloadOnStartup(): Promise<SyncResult | null> {
  if (!settings.value.webdavEnabled || !settings.value.webdavAutoSync || !settings.value.webdavUrl)
    return null

  if (settings.value.webdavLocalModifiedTime > settings.value.webdavLastSyncTime)
    return { ok: true, skipped: true }

  return downloadSettings({ onlyIfNewer: true })
}
