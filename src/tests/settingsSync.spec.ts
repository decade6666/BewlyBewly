import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadSettings, listSettingsBackups, uploadSettings } from '../logic/settingsSync'
import type { BlockedWordsState, Settings } from '../logic/storage'
import { blockedWords, originalSettings, settings } from '../logic/storage'
import { buildBackupFilename, RETENTION_LIMIT } from '../logic/webdavBackups'

const webdavMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  download: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: { get: async () => ({}), set: async () => undefined },
    sync: { get: async () => ({}), set: async () => undefined },
  },
}))

vi.mock('../logic/webdav', async () => {
  const actual = await vi.importActual<typeof import('../logic/webdav')>('../logic/webdav')
  return {
    ...actual,
    webdavDeleteViaBackground: webdavMocks.delete,
    webdavDownloadViaBackground: webdavMocks.download,
    webdavListViaBackground: webdavMocks.list,
    webdavUploadViaBackground: webdavMocks.upload,
  }
})

const MANAGED_DIRECTORY = '/backups/'
const LEGACY_FILE_PATH = '/backups/settings.json'
const DIRECTORY_URL = 'https://local.example/dav'
const BASE_TIMESTAMP = Date.UTC(2026, 6, 11, 4, 29, 0, 123)

function managedBackupPath(timestampMs: number, sequence = 1): string {
  return `${MANAGED_DIRECTORY}${buildBackupFilename(timestampMs, sequence)}`
}

function legacyEnvelope(
  timestamp: number,
  settingsOverrides: Partial<Settings> = {},
  blockedWordsState: BlockedWordsState = { enabled: false, words: [] },
): string {
  return JSON.stringify({
    version: 1,
    timestamp,
    settings: settingsOverrides,
    blockedWords: blockedWordsState,
  })
}

function directoryListingXml(requestPaths: readonly string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
    <d:multistatus xmlns:d="DAV:">
      <d:response>
        <d:href>/dav/backups/</d:href>
        <d:propstat>
          <d:prop>
            <d:resourcetype><d:collection/></d:resourcetype>
          </d:prop>
        </d:propstat>
      </d:response>
      ${requestPaths.map(requestPath => `
        <d:response>
          <d:href>/dav${requestPath}</d:href>
          <d:propstat>
            <d:prop><d:resourcetype/></d:prop>
          </d:propstat>
        </d:response>
      `).join('')}
    </d:multistatus>`
}

function uploadCalls(): Array<{ path: string, createOnly?: boolean, data: string }> {
  return webdavMocks.upload.mock.calls.map(([config, data, options]) => ({
    path: config.path,
    createOnly: options?.createOnly,
    data,
  }))
}

function deletePaths(): string[] {
  return webdavMocks.delete.mock.calls.map(([config]) => config.path)
}

function expectLocalStateUnchanged(previousSettings: Settings, previousBlockedWords: BlockedWordsState) {
  expect(settings.value).toEqual(previousSettings)
  expect(blockedWords.value).toEqual(previousBlockedWords)
}

beforeEach(() => {
  settings.value = {
    ...originalSettings,
    theme: 'light',
    webdavEnabled: true,
    webdavUrl: DIRECTORY_URL,
    webdavUsername: 'local-user',
    webdavPassword: 'local-password',
    webdavPath: MANAGED_DIRECTORY,
    webdavLegacyFilePath: LEGACY_FILE_PATH,
  }
  blockedWords.value = { enabled: false, words: ['local-only'] }
  webdavMocks.delete.mockReset()
  webdavMocks.download.mockReset()
  webdavMocks.list.mockReset()
  webdavMocks.upload.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settingsSync versioned WebDAV orchestration', () => {
  it('lists managed backups newest-first and inserts a valid legacy file by envelope timestamp', async () => {
    const olderVersioned = managedBackupPath(BASE_TIMESTAMP - 2_000)
    const newerVersioned = managedBackupPath(BASE_TIMESTAMP - 1_000)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([olderVersioned, newerVersioned, LEGACY_FILE_PATH]),
    })
    webdavMocks.download.mockResolvedValue({
      ok: true,
      status: 200,
      data: legacyEnvelope(BASE_TIMESTAMP - 1_500),
    })

    await expect(listSettingsBackups()).resolves.toEqual({
      ok: true,
      backups: [
        expect.objectContaining({ requestPath: newerVersioned, source: 'versioned', timestampMs: BASE_TIMESTAMP - 1_000 }),
        expect.objectContaining({ requestPath: LEGACY_FILE_PATH, source: 'legacy', timestampMs: BASE_TIMESTAMP - 1_500 }),
        expect.objectContaining({ requestPath: olderVersioned, source: 'versioned', timestampMs: BASE_TIMESTAMP - 2_000 }),
      ],
    })
    expect(settings.value.webdavLegacyFilePath).toBe(LEGACY_FILE_PATH)
    expect(webdavMocks.download).toHaveBeenCalledWith(expect.objectContaining({ path: LEGACY_FILE_PATH }))
  })

  it('keeps healthy versioned backups and reports legacy_unreadable when the legacy envelope is unreadable', async () => {
    const versioned = managedBackupPath(BASE_TIMESTAMP - 500)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([versioned, LEGACY_FILE_PATH]),
    })
    webdavMocks.download.mockResolvedValue({ ok: true, status: 200, data: '{not json' })

    await expect(listSettingsBackups()).resolves.toEqual({
      ok: true,
      backups: [expect.objectContaining({ requestPath: versioned, source: 'versioned' })],
      warnings: ['legacy_unreadable'],
    })
    expect(settings.value.webdavLegacyFilePath).toBe(LEGACY_FILE_PATH)
  })

  it('clears the legacy locator when the legacy file returns 404', async () => {
    const versioned = managedBackupPath(BASE_TIMESTAMP - 500)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([versioned, LEGACY_FILE_PATH]),
    })
    webdavMocks.download.mockResolvedValue({ ok: false, status: 404, error: 'not_found' })

    await expect(listSettingsBackups()).resolves.toEqual({
      ok: true,
      backups: [expect.objectContaining({ requestPath: versioned, source: 'versioned' })],
    })
    expect(settings.value.webdavLegacyFilePath).toBe('')
  })

  it('clears the legacy locator without warning when a successful directory listing confirms it is absent', async () => {
    const versioned = managedBackupPath(BASE_TIMESTAMP - 500)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([versioned]),
    })

    await expect(listSettingsBackups()).resolves.toEqual({
      ok: true,
      backups: [expect.objectContaining({ requestPath: versioned, source: 'versioned' })],
    })
    expect(webdavMocks.download).not.toHaveBeenCalled()
    expect(settings.value.webdavLegacyFilePath).toBe('')
  })

  it('treats a directory 404 as a successful empty list', async () => {
    webdavMocks.list.mockResolvedValue({ ok: false, status: 404, error: 'not_found' })

    await expect(listSettingsBackups()).resolves.toEqual({
      ok: true,
      backups: [],
    })
    expect(settings.value.webdavLegacyFilePath).toBe(LEGACY_FILE_PATH)
  })

  it('returns invalid_multistatus without mutating local state when the directory XML is invalid', async () => {
    const previousSettings = { ...settings.value }
    const previousBlockedWords = { ...blockedWords.value, words: [...blockedWords.value.words] }
    webdavMocks.list.mockResolvedValue({ ok: true, status: 207, data: 'not xml' })

    await expect(listSettingsBackups()).resolves.toEqual({ ok: false, error: 'invalid_multistatus' })
    expectLocalStateUnchanged(previousSettings, previousBlockedWords)
  })

  it('creates a new versioned backup, excludes local WebDAV-only fields, and deletes every extra oldest backup after success', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)

    const newestPath = managedBackupPath(BASE_TIMESTAMP, 2)
    const existingPaths = Array.from({ length: RETENTION_LIMIT + 2 }, (_, index) =>
      managedBackupPath(BASE_TIMESTAMP - (index + 1)))
    webdavMocks.upload
      .mockResolvedValueOnce({ ok: false, status: 412, error: 'Precondition Failed' })
      .mockResolvedValueOnce({ ok: true, status: 201 })
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([newestPath, ...existingPaths]),
    })
    webdavMocks.delete.mockResolvedValue({ ok: true, status: 204 })

    await expect(uploadSettings()).resolves.toEqual({ ok: true })

    expect(uploadCalls()).toEqual([
      expect.objectContaining({ path: managedBackupPath(BASE_TIMESTAMP, 1), createOnly: true }),
      expect.objectContaining({ path: newestPath, createOnly: true }),
    ])
    expect(JSON.parse(uploadCalls()[0].data)).toEqual({
      version: 1,
      timestamp: BASE_TIMESTAMP,
      settings: expect.not.objectContaining({
        webdavEnabled: expect.anything(),
        webdavUrl: expect.anything(),
        webdavUsername: expect.anything(),
        webdavPassword: expect.anything(),
        webdavPath: expect.anything(),
        webdavLastSyncTime: expect.anything(),
        webdavLegacyFilePath: expect.anything(),
      }),
      blockedWords: { enabled: false, words: ['local-only'] },
    })
    expect(settings.value.webdavLastSyncTime).toBe(BASE_TIMESTAMP)
    expect(deletePaths()).toEqual([
      managedBackupPath(BASE_TIMESTAMP - (RETENTION_LIMIT + 2)),
      managedBackupPath(BASE_TIMESTAMP - (RETENTION_LIMIT + 1)),
      managedBackupPath(BASE_TIMESTAMP - RETENTION_LIMIT),
    ])
  })

  it('returns the original failed create result without cleanup when a non-412 PUT failure is not proven to be a collision', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)
    webdavMocks.upload.mockResolvedValue({ ok: false, status: 409, error: 'Conflict' })
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([]),
    })

    await expect(uploadSettings()).resolves.toEqual({ ok: false, error: 'Conflict' })
    expect(uploadCalls()).toHaveLength(1)
    expect(deletePaths()).toEqual([])
    expect(settings.value.webdavLastSyncTime).toBe(0)
  })

  it('retries the next sequence when a non-412 create-only PUT failure is proven to be a collision by a successful directory list', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)

    const firstCandidate = managedBackupPath(BASE_TIMESTAMP, 1)
    const secondCandidate = managedBackupPath(BASE_TIMESTAMP, 2)
    webdavMocks.upload
      .mockResolvedValueOnce({ ok: false, status: 409, error: 'Conflict' })
      .mockResolvedValueOnce({ ok: true, status: 201 })
    webdavMocks.list
      .mockResolvedValueOnce({
        ok: true,
        status: 207,
        data: directoryListingXml([firstCandidate]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 207,
        data: directoryListingXml([secondCandidate]),
      })

    await expect(uploadSettings()).resolves.toEqual({ ok: true })

    expect(uploadCalls()).toEqual([
      expect.objectContaining({ path: firstCandidate, createOnly: true }),
      expect.objectContaining({ path: secondCandidate, createOnly: true }),
    ])
    expect(deletePaths()).toEqual([])
    expect(settings.value.webdavLastSyncTime).toBe(BASE_TIMESTAMP)
  })

  it('includes the HTTP status in the upload failure when no server error text is available and the candidate is not proven to exist', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)
    webdavMocks.upload.mockResolvedValue({ ok: false, status: 409, error: '' })
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([]),
    })

    await expect(uploadSettings()).resolves.toEqual({ ok: false, error: 'upload_failed_409' })
    expect(uploadCalls()).toHaveLength(1)
    expect(deletePaths()).toEqual([])
    expect(settings.value.webdavLastSyncTime).toBe(0)
  })

  it('fails with upload_collision_exhausted after ten create-only collisions', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)
    webdavMocks.upload.mockResolvedValue({ ok: false, status: 412, error: 'Precondition Failed' })

    await expect(uploadSettings()).resolves.toEqual({ ok: false, error: 'upload_collision_exhausted' })
    expect(uploadCalls()).toHaveLength(10)
    expect(webdavMocks.list).not.toHaveBeenCalled()
    expect(deletePaths()).toEqual([])
    expect(settings.value.webdavLastSyncTime).toBe(0)
  })

  it('returns cleanup_partial on delete failures and retries every remaining extra backup from remote state on the next upload', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(BASE_TIMESTAMP)
      .mockReturnValueOnce(BASE_TIMESTAMP + 10_000)

    const firstUpload = managedBackupPath(BASE_TIMESTAMP, 1)
    const secondUpload = managedBackupPath(BASE_TIMESTAMP + 10_000, 1)
    const oldBackups = Array.from({ length: RETENTION_LIMIT + 1 }, (_, index) =>
      managedBackupPath(BASE_TIMESTAMP - (index + 1)))

    webdavMocks.upload
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: true, status: 201 })
    webdavMocks.list
      .mockResolvedValueOnce({
        ok: true,
        status: 207,
        data: directoryListingXml([firstUpload, ...oldBackups]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 207,
        data: directoryListingXml([secondUpload, firstUpload, ...oldBackups.slice(0, 19), oldBackups[20]]),
      })
    webdavMocks.delete
      .mockResolvedValueOnce({ ok: false, status: 500, error: 'delete_failed' })
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: true, status: 204 })

    await expect(uploadSettings()).resolves.toEqual({ ok: true, warning: 'cleanup_partial' })
    await expect(uploadSettings()).resolves.toEqual({ ok: true })

    expect(deletePaths()).toEqual([
      managedBackupPath(BASE_TIMESTAMP - (RETENTION_LIMIT + 1)),
      managedBackupPath(BASE_TIMESTAMP - RETENTION_LIMIT),
      managedBackupPath(BASE_TIMESTAMP - (RETENTION_LIMIT + 1)),
      managedBackupPath(BASE_TIMESTAMP - (RETENTION_LIMIT - 1)),
    ])
    expect(settings.value.webdavLastSyncTime).toBe(BASE_TIMESTAMP + 10_000)
  })

  it('returns cleanup_partial without attempting delete when the post-upload list fails after the new backup is created', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIMESTAMP)
    webdavMocks.upload.mockResolvedValueOnce({ ok: true, status: 201 })
    webdavMocks.list.mockResolvedValueOnce({ ok: false, status: 500, error: 'list_failed' })

    await expect(uploadSettings()).resolves.toEqual({ ok: true, warning: 'cleanup_partial' })

    expect(uploadCalls()).toEqual([
      expect.objectContaining({ path: managedBackupPath(BASE_TIMESTAMP, 1), createOnly: true }),
    ])
    expect(deletePaths()).toEqual([])
    expect(settings.value.webdavLastSyncTime).toBe(BASE_TIMESTAMP)
  })

  it('downloads the selected backup after revalidation and preserves local WebDAV configuration including the legacy locator', async () => {
    const selectedPath = managedBackupPath(BASE_TIMESTAMP - 2_000)
    const newerPath = managedBackupPath(BASE_TIMESTAMP - 500)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([newerPath, selectedPath, LEGACY_FILE_PATH]),
    })
    webdavMocks.download
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: legacyEnvelope(BASE_TIMESTAMP - 1_500),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: legacyEnvelope(
          BASE_TIMESTAMP - 2_000,
          { theme: 'dark', webdavUrl: 'https://remote.example/ignored' },
          { enabled: true, words: ['spoiler'] },
        ),
      })

    await expect(downloadSettings(selectedPath)).resolves.toEqual({ ok: true })
    expect(webdavMocks.download).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: selectedPath }))
    expect(settings.value).toMatchObject({
      theme: 'dark',
      webdavEnabled: true,
      webdavUrl: DIRECTORY_URL,
      webdavUsername: 'local-user',
      webdavPassword: 'local-password',
      webdavPath: MANAGED_DIRECTORY,
      webdavLegacyFilePath: LEGACY_FILE_PATH,
      webdavLastSyncTime: BASE_TIMESTAMP - 2_000,
    })
    expect(blockedWords.value).toEqual({ enabled: true, words: ['spoiler'] })
  })

  it('clears the legacy locator before applying a successful selected versioned restore when the scan confirms the legacy file is absent', async () => {
    const selectedPath = managedBackupPath(BASE_TIMESTAMP - 2_000)
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([selectedPath]),
    })
    webdavMocks.download.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: legacyEnvelope(
        BASE_TIMESTAMP - 2_000,
        { theme: 'dark' },
        { enabled: true, words: ['restored-word'] },
      ),
    })

    await expect(downloadSettings(selectedPath)).resolves.toEqual({ ok: true })

    expect(settings.value).toMatchObject({
      theme: 'dark',
      webdavLegacyFilePath: '',
      webdavLastSyncTime: BASE_TIMESTAMP - 2_000,
    })
    expect(blockedWords.value).toEqual({ enabled: true, words: ['restored-word'] })
  })

  it('returns selected_backup_not_found when no selected backup path is provided', async () => {
    await expect(downloadSettings()).resolves.toEqual({ ok: false, error: 'selected_backup_not_found' })
    expect(webdavMocks.list).not.toHaveBeenCalled()
    expect(webdavMocks.download).not.toHaveBeenCalled()
  })

  it('returns selected_backup_not_found without mutating local state when the selected backup disappears during revalidation', async () => {
    const selectedPath = managedBackupPath(BASE_TIMESTAMP - 2_000)
    const previousSettings = { ...settings.value }
    const previousBlockedWords = { ...blockedWords.value, words: [...blockedWords.value.words] }
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([managedBackupPath(BASE_TIMESTAMP - 500)]),
    })

    await expect(downloadSettings(selectedPath)).resolves.toEqual({ ok: false, error: 'selected_backup_not_found' })
    expect(webdavMocks.download).not.toHaveBeenCalled()
    expectLocalStateUnchanged(previousSettings, previousBlockedWords)
  })

  it('does not mutate local settings or blocked words when the selected backup JSON is malformed', async () => {
    const selectedPath = managedBackupPath(BASE_TIMESTAMP - 2_000)
    const previousSettings = { ...settings.value }
    const previousBlockedWords = { ...blockedWords.value, words: [...blockedWords.value.words] }
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([selectedPath, LEGACY_FILE_PATH]),
    })
    webdavMocks.download
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: legacyEnvelope(BASE_TIMESTAMP - 1_500),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, data: 'null' })

    await expect(downloadSettings(selectedPath)).resolves.toEqual({ ok: false, error: 'parse_error' })
    expectLocalStateUnchanged(previousSettings, previousBlockedWords)
  })

  it('does not clear the legacy locator when the selected backup fails to parse after a scan confirms the legacy file is absent', async () => {
    const selectedPath = managedBackupPath(BASE_TIMESTAMP - 2_000)
    const previousSettings = { ...settings.value }
    const previousBlockedWords = { ...blockedWords.value, words: [...blockedWords.value.words] }
    webdavMocks.list.mockResolvedValue({
      ok: true,
      status: 207,
      data: directoryListingXml([selectedPath]),
    })
    webdavMocks.download.mockResolvedValueOnce({ ok: true, status: 200, data: 'null' })

    await expect(downloadSettings(selectedPath)).resolves.toEqual({ ok: false, error: 'parse_error' })
    expectLocalStateUnchanged(previousSettings, previousBlockedWords)
  })
})
