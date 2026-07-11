import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadSettings } from '../logic/settingsSync'
import { blockedWords, originalSettings, settings } from '../logic/storage'

const webdavMocks = vi.hoisted(() => ({
  download: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: { get: async () => ({}), set: async () => undefined },
    sync: { get: async () => ({}), set: async () => undefined },
  },
}))

vi.mock('../logic/webdav', () => ({
  webdavDownloadViaBackground: webdavMocks.download,
  webdavUploadViaBackground: webdavMocks.upload,
}))

beforeEach(() => {
  settings.value = {
    ...originalSettings,
    webdavEnabled: true,
    webdavUrl: 'https://local.example/dav',
    webdavUsername: 'local-user',
    webdavPassword: 'local-password',
    webdavPath: '/local/settings.json',
  }
  blockedWords.value = { enabled: false, words: [] }
  webdavMocks.download.mockReset()
  webdavMocks.upload.mockReset()
})

describe('manual WebDAV download envelope validation', () => {
  it('returns a parse error instead of rejecting when the remote JSON is null', async () => {
    webdavMocks.download.mockResolvedValue({ ok: true, status: 200, data: 'null' })

    await expect(downloadSettings()).resolves.toEqual({ ok: false, error: 'parse_error' })
  })

  it('rejects a malformed version-1 envelope without changing local state', async () => {
    const localSettings = settings.value
    webdavMocks.download.mockResolvedValue({
      ok: true,
      status: 200,
      data: JSON.stringify({
        version: 1,
        timestamp: 'not-a-number',
        settings: {},
        blockedWords: { enabled: false, words: [] },
      }),
    })

    await expect(downloadSettings()).resolves.toEqual({ ok: false, error: 'parse_error' })
    expect(settings.value).toBe(localSettings)
  })

  it('applies a valid version-1 envelope while preserving local WebDAV configuration', async () => {
    webdavMocks.download.mockResolvedValue({
      ok: true,
      status: 200,
      data: JSON.stringify({
        version: 1,
        timestamp: 123,
        settings: {
          theme: 'dark',
          webdavUrl: 'https://remote.example/ignored',
        },
        blockedWords: { enabled: true, words: ['spoiler'] },
      }),
    })

    await expect(downloadSettings()).resolves.toEqual({ ok: true })
    expect(settings.value).toMatchObject({
      theme: 'dark',
      webdavEnabled: true,
      webdavUrl: 'https://local.example/dav',
      webdavUsername: 'local-user',
      webdavPassword: 'local-password',
      webdavPath: '/local/settings.json',
      webdavLastSyncTime: 123,
    })
    expect(blockedWords.value).toEqual({ enabled: true, words: ['spoiler'] })
  })
})
