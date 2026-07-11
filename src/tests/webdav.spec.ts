import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WebDavConfig } from '../logic/webdav'
import {
  WEBDAV_MESSAGE,
  webdavDelete,
  webdavDeleteViaBackground,
  webdavList,
  webdavListViaBackground,
  webdavUpload,
  webdavUploadViaBackground,
} from '../logic/webdav'

const browserMocks = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(),
  },
}))

vi.mock('webextension-polyfill', () => ({
  default: browserMocks,
}))

function makeConfig(path: string, overrides: Partial<WebDavConfig> = {}): WebDavConfig {
  return {
    url: 'https://example.com/dav',
    username: 'bewly-user',
    password: 'bewly-pass',
    path,
    ...overrides,
  }
}

function getHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers)
}

describe('webdav transport', () => {
  const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>()

  function getFetchCall(index: number): readonly [RequestInfo | URL, RequestInit] {
    const [url, init] = fetchMock.mock.calls[index] as [RequestInfo | URL, RequestInit?]
    return [url, init ?? {}]
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    browserMocks.runtime.sendMessage.mockReset()
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('background runtime messages', () => {
    it('sends LIST and DELETE requests through runtime messaging', async () => {
      const listConfig = makeConfig('/bewly/')
      const deleteConfig = makeConfig('/bewly/archive.json')

      browserMocks.runtime.sendMessage
        .mockResolvedValueOnce({ ok: true, status: 207, data: '<multistatus />' })
        .mockResolvedValueOnce({ ok: true, status: 204 })

      await expect(webdavListViaBackground(listConfig)).resolves.toEqual({
        ok: true,
        status: 207,
        data: '<multistatus />',
      })
      await expect(webdavDeleteViaBackground(deleteConfig)).resolves.toEqual({
        ok: true,
        status: 204,
      })

      expect(browserMocks.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
        contentScriptQuery: WEBDAV_MESSAGE.LIST,
        config: listConfig,
      })
      expect(browserMocks.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
        contentScriptQuery: WEBDAV_MESSAGE.DELETE,
        config: deleteConfig,
      })
    })

    it('forwards create-only upload requests without stripping the collision guard', async () => {
      const config = makeConfig('/bewly/settings.json')
      browserMocks.runtime.sendMessage.mockResolvedValueOnce({ ok: false, status: 412, error: 'Precondition Failed' })

      await expect(webdavUploadViaBackground(config, '{"version":1}', { createOnly: true })).resolves.toEqual({
        ok: false,
        status: 412,
        error: 'Precondition Failed',
      })

      expect(browserMocks.runtime.sendMessage).toHaveBeenCalledWith({
        contentScriptQuery: WEBDAV_MESSAGE.UPLOAD,
        config,
        data: '{"version":1}',
        createOnly: true,
      })
    })
  })

  describe('list', () => {
    it('uses PROPFIND Depth: 1 and returns the raw XML body unchanged', async () => {
      const xml = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" />'
      fetchMock.mockResolvedValueOnce(new Response(xml, { status: 207 }))

      const result = await webdavList(makeConfig('/bewly/'))

      expect(result).toEqual({ ok: true, status: 207, data: xml })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const [url, init] = getFetchCall(0)
      expect(String(url)).toBe('https://example.com/dav/bewly/')
      expect(init.method).toBe('PROPFIND')
      expect(getHeaders(init).get('Depth')).toBe('1')
      expect(getHeaders(init).get('Authorization')).toMatch(/^Basic /)
      expect(getHeaders(init).get('Content-Type')).toBe('application/xml; charset=utf-8')
      expect(String(init.body)).toContain('<d:resourcetype/>')
      expect(String(init.body)).toContain('<d:getlastmodified/>')
      expect(String(init.body)).toContain('<d:getcontentlength/>')
    })

    it('returns an explicit not_found result for a missing directory', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))

      await expect(webdavList(makeConfig('/bewly/'))).resolves.toEqual({
        ok: false,
        status: 404,
        error: 'not_found',
      })
    })

    it('passes through malformed response text when the transport status is 200', async () => {
      fetchMock.mockResolvedValueOnce(new Response('this is not xml', { status: 200 }))

      await expect(webdavList(makeConfig('/bewly/'))).resolves.toEqual({
        ok: true,
        status: 200,
        data: 'this is not xml',
      })
    })
  })

  describe('upload', () => {
    it('segment-encodes file paths once, keeps credentials in headers, and sends If-None-Match for create-only PUTs', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 207 }))
        .mockResolvedValueOnce(new Response('', { status: 201 }))

      const result = await webdavUpload(
        makeConfig('/bewly/a b&c.json', {
          url: 'https://base-user:base-pass@example.com/dav',
          username: 'header-user',
          password: 'header-pass',
        }),
        '{"version":1}',
        { createOnly: true },
      )

      expect(result).toEqual({ ok: true, status: 201 })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      const [parentUrl, parentInit] = getFetchCall(0)
      expect(String(parentUrl)).toBe('https://example.com/dav/bewly/')
      expect(parentInit.method).toBe('PROPFIND')
      expect(getHeaders(parentInit).get('Depth')).toBe('0')

      const [putUrl, putInit] = getFetchCall(1)
      expect(String(putUrl)).toBe('https://example.com/dav/bewly/a%20b%26c.json')
      expect(putInit.method).toBe('PUT')
      expect(getHeaders(putInit).get('Authorization')).toMatch(/^Basic /)
      expect(getHeaders(putInit).get('If-None-Match')).toBe('*')
      expect(getHeaders(putInit).get('Content-Type')).toBe('application/json; charset=utf-8')
      expect(String(putInit.body)).toBe('{"version":1}')
      expect(String(putUrl)).not.toContain('base-user:base-pass@')
    })

    it('surfaces create-only collisions without falling back to an unconditional overwrite', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 207 }))
        .mockResolvedValueOnce(new Response('', { status: 412, statusText: 'Precondition Failed' }))

      await expect(webdavUpload(makeConfig('/bewly/settings.json'), '{"version":1}', { createOnly: true })).resolves.toEqual({
        ok: false,
        status: 412,
        error: 'Precondition Failed',
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const [, putInit] = getFetchCall(1)
      expect(putInit.method).toBe('PUT')
      expect(getHeaders(putInit).get('If-None-Match')).toBe('*')
    })

    it('keeps legacy uploads unconditional when createOnly is omitted', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 207 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))

      await expect(webdavUpload(makeConfig('/bewly/settings.json'), '{"version":1}')).resolves.toEqual({
        ok: true,
        status: 204,
      })

      const [, putInit] = getFetchCall(1)
      expect(getHeaders(putInit).get('If-None-Match')).toBeNull()
    })

    it('rejects invalid dot and unencodable path segments before any network request', async () => {
      await expect(webdavUpload(makeConfig('/bewly/../settings.json'), '{"version":1}')).resolves.toEqual({
        ok: false,
        status: 0,
        error: 'invalid_path',
      })

      await expect(webdavUpload(makeConfig(`/bewly/${'\uD83D'}.json`), '{"version":1}')).resolves.toEqual({
        ok: false,
        status: 0,
        error: 'invalid_path',
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('aborts before PUT when a parent directory check or creation fails', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('', { status: 201 }))
        .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }))

      await expect(webdavUpload(makeConfig('/bewly/nested/settings.json'), '{"version":1}')).resolves.toEqual({
        ok: false,
        status: 500,
        error: 'Internal Server Error',
      })

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(String(getFetchCall(0)[0])).toBe('https://example.com/dav/bewly/')
      expect(String(getFetchCall(1)[0])).toBe('https://example.com/dav/bewly/')
      expect(String(getFetchCall(2)[0])).toBe('https://example.com/dav/bewly/nested/')
      expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['PROPFIND', 'MKCOL', 'PROPFIND'])
    })
  })

  describe('delete', () => {
    it('deletes a single encoded file target', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

      await expect(webdavDelete(makeConfig('/bewly/a b&c.json'))).resolves.toEqual({
        ok: true,
        status: 204,
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = getFetchCall(0)
      expect(String(url)).toBe('https://example.com/dav/bewly/a%20b%26c.json')
      expect(init.method).toBe('DELETE')
    })

    it('rejects directory targets before fetch so it never recursively deletes a collection', async () => {
      await expect(webdavDelete(makeConfig('/bewly/'))).resolves.toEqual({
        ok: false,
        status: 0,
        error: 'invalid_delete_target',
      })

      await expect(webdavDelete(makeConfig('/'))).resolves.toEqual({
        ok: false,
        status: 0,
        error: 'invalid_delete_target',
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('treats 404 as an idempotent delete success', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))

      await expect(webdavDelete(makeConfig('/bewly/missing.json'))).resolves.toEqual({
        ok: true,
        status: 404,
      })
    })
  })

  describe('background source contract', () => {
    it('keeps LIST and DELETE dispatch in the background listener without importing DOMParser', async () => {
      const source = await readFile(resolve('src/background/messageListeners/webdav.ts'), 'utf8')

      expect(source).toContain('case WEBDAV_MESSAGE.LIST')
      expect(source).toContain('case WEBDAV_MESSAGE.DELETE')
      expect(source).toContain('browser.runtime.onMessage.addListener')
      expect(source).not.toContain('DOMParser')
      expect(source).not.toContain('webdavBackups')
    })
  })
})
