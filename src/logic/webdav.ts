import browser from 'webextension-polyfill'

export interface WebDavConfig {
  url: string
  username: string
  password: string
  path: string
}

export interface WebDavResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

export interface WebDavUploadOptions {
  createOnly?: boolean
}

/**
 * WebDAV network requests must run in the background/service worker, not in the
 * linux.do content script. The content script inherits the linux.do page origin,
 * so cross-origin `fetch` to an arbitrary WebDAV server is rejected by CORS and
 * surfaces as `Failed to fetch`. The background context has `<all_urls>` host
 * permission and can reach any WebDAV origin directly.
 */
export enum WEBDAV_MESSAGE {
  TEST = 'webdavTest',
  LIST = 'webdavList',
  UPLOAD = 'webdavUpload',
  DOWNLOAD = 'webdavDownload',
  DELETE = 'webdavDelete',
}

interface WebdavBackgroundMessage {
  contentScriptQuery: WEBDAV_MESSAGE
  config: WebDavConfig
  data?: string
  createOnly?: boolean
}

function isWebdavResult<T>(value: unknown): value is WebDavResult<T> {
  return typeof value === 'object' && value !== null && 'ok' in value && 'status' in value
}

async function requestWebdavViaBackground<T>(message: WebdavBackgroundMessage): Promise<WebDavResult<T>> {
  try {
    const response = await browser.runtime.sendMessage(message)
    if (isWebdavResult<T>(response))
      return response
    return { ok: false, status: 0, error: 'invalid_background_response' }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

/** Content-script entry point: run the WebDAV connection test in the background. */
export function webdavTestViaBackground(config: WebDavConfig): Promise<WebDavResult> {
  return requestWebdavViaBackground({ contentScriptQuery: WEBDAV_MESSAGE.TEST, config })
}

/** Content-script entry point: list a WebDAV directory through the background. */
export function webdavListViaBackground(config: WebDavConfig): Promise<WebDavResult<string>> {
  return requestWebdavViaBackground<string>({ contentScriptQuery: WEBDAV_MESSAGE.LIST, config })
}

/** Content-script entry point: upload a settings snapshot through the background. */
export function webdavUploadViaBackground(
  config: WebDavConfig,
  data: string,
  options: WebDavUploadOptions = {},
): Promise<WebDavResult> {
  return requestWebdavViaBackground({
    contentScriptQuery: WEBDAV_MESSAGE.UPLOAD,
    config,
    data,
    createOnly: Boolean(options.createOnly),
  })
}

/** Content-script entry point: download the settings snapshot through the background. */
export function webdavDownloadViaBackground(config: WebDavConfig): Promise<WebDavResult<string>> {
  return requestWebdavViaBackground<string>({ contentScriptQuery: WEBDAV_MESSAGE.DOWNLOAD, config })
}

/** Content-script entry point: delete one WebDAV file through the background. */
export function webdavDeleteViaBackground(config: WebDavConfig): Promise<WebDavResult> {
  return requestWebdavViaBackground({ contentScriptQuery: WEBDAV_MESSAGE.DELETE, config })
}

function encodeBasicAuth(username: string, password: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`)))
}

function buildHeaders(config: WebDavConfig): HeadersInit {
  const headers: HeadersInit = {}
  if (config.username) {
    headers.Authorization = `Basic ${encodeBasicAuth(config.username, config.password)}`
  }
  return headers
}

type WebDavPathKind = 'directory' | 'file'

interface ResolvedWebDavPath {
  encodedPath: string
  segments: readonly string[]
}

const DIRECTORY_LIST_BODY = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/><d:getcontentlength/></d:prop></d:propfind>'

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1F || code === 0x7F || (code >= 0x80 && code <= 0x9F))
      return true
  }
  return false
}

function validatePathSegment(segment: string): void {
  if (segment === '.' || segment === '..' || hasControlCharacters(segment))
    throw new Error('invalid_path')

  try {
    encodeURIComponent(segment)
  }
  catch {
    throw new Error('invalid_path')
  }
}

function encodePathSegments(segments: readonly string[]): string {
  return segments.map((segment) => {
    validatePathSegment(segment)
    return encodeURIComponent(segment)
  }).join('/')
}

function resolvePath(path: string, kind: WebDavPathKind): ResolvedWebDavPath {
  const rawPath = typeof path === 'string' ? path : ''
  const absolutePath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const segments = absolutePath.split('/').filter(segment => segment.length > 0)

  if (kind === 'file') {
    if (segments.length === 0 || absolutePath.endsWith('/'))
      throw new Error('invalid_path')
  }

  const encodedSegments = encodePathSegments(segments)
  if (segments.length === 0)
    return { encodedPath: '/', segments }

  return {
    encodedPath: kind === 'directory'
      ? `/${encodedSegments}/`
      : `/${encodedSegments}`,
    segments,
  }
}

function createBaseUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('invalid_url')
  url.username = ''
  url.password = ''
  url.hash = ''
  return url
}

function joinBasePathname(basePathname: string, encodedPath: string): string {
  const trimmedBasePath = basePathname === '/' ? '' : basePathname.replace(/\/+$/, '')

  if (encodedPath === '/')
    return trimmedBasePath.length > 0 ? `${trimmedBasePath}/` : '/'

  return `${trimmedBasePath}${encodedPath}`
}

function resolveEncodedUrl(rawUrl: string, encodedPath: string): string {
  const url = createBaseUrl(rawUrl)
  url.pathname = joinBasePathname(url.pathname || '/', encodedPath)
  return url.toString()
}

function resolveConfiguredUrl(config: WebDavConfig, kind: WebDavPathKind): string {
  const resolvedPath = resolvePath(config.path, kind)
  return resolveEncodedUrl(config.url, resolvedPath.encodedPath)
}

export function resolveWebdavDirectoryUrl(config: WebDavConfig): string {
  return resolveConfiguredUrl(config, 'directory')
}

function resolveDirectoryUrl(rawUrl: string, segments: readonly string[]): string {
  const encodedPath = segments.length === 0 ? '/' : `/${encodePathSegments(segments)}/`
  return resolveEncodedUrl(rawUrl, encodedPath)
}

function isDirectoryTarget(path: string): boolean {
  const rawPath = typeof path === 'string' ? path : ''
  const absolutePath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return absolutePath === '/' || absolutePath.endsWith('/')
}

export async function webdavTest(config: WebDavConfig): Promise<WebDavResult> {
  try {
    const res = await fetch(createBaseUrl(config.url).toString().replace(/\/+$/, ''), {
      method: 'PROPFIND',
      headers: {
        ...buildHeaders(config),
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    })
    return { ok: res.status === 207 || res.status === 200, status: res.status }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

export async function webdavList(config: WebDavConfig): Promise<WebDavResult<string>> {
  try {
    const url = resolveConfiguredUrl(config, 'directory')
    const res = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        ...buildHeaders(config),
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: DIRECTORY_LIST_BODY,
    })

    if (res.status === 404)
      return { ok: false, status: 404, error: 'not_found' }

    if (res.status !== 200 && res.status !== 207)
      return { ok: false, status: res.status, error: res.statusText || 'list_failed' }

    return { ok: true, status: res.status, data: await res.text() }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

async function ensureParentDir(config: WebDavConfig, fileSegments: readonly string[]): Promise<WebDavResult | null> {
  const parentSegments = fileSegments.slice(0, -1)
  if (parentSegments.length === 0)
    return null

  for (let index = 0; index < parentSegments.length; index += 1) {
    const currentSegments = parentSegments.slice(0, index + 1)
    const dirUrl = resolveDirectoryUrl(config.url, currentSegments)

    let check: Response
    try {
      check = await fetch(dirUrl, {
        method: 'PROPFIND',
        headers: { ...buildHeaders(config), 'Depth': '0' },
      })
    }
    catch (e) {
      return { ok: false, status: 0, error: (e as Error).message }
    }

    if (check.status === 200 || check.status === 207)
      continue

    if (check.status !== 404)
      return { ok: false, status: check.status, error: check.statusText || 'parent_check_failed' }

    let create: Response
    try {
      create = await fetch(dirUrl, {
        method: 'MKCOL',
        headers: buildHeaders(config),
      })
    }
    catch (e) {
      return { ok: false, status: 0, error: (e as Error).message }
    }

    if (create.status === 201 || create.status === 301 || create.status === 405)
      continue

    return { ok: false, status: create.status, error: create.statusText || 'parent_create_failed' }
  }

  return null
}

export async function webdavUpload(
  config: WebDavConfig,
  data: string,
  options: WebDavUploadOptions = {},
): Promise<WebDavResult> {
  try {
    const resolvedPath = resolvePath(config.path, 'file')
    const parentResult = await ensureParentDir(config, resolvedPath.segments)
    if (parentResult)
      return parentResult

    const url = resolveEncodedUrl(config.url, resolvedPath.encodedPath)
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...buildHeaders(config),
        'Content-Type': 'application/json; charset=utf-8',
        ...(options.createOnly ? { 'If-None-Match': '*' } : {}),
      },
      body: data,
    })
    if (!res.ok)
      return { ok: false, status: res.status, error: res.statusText }
    return { ok: true, status: res.status }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

export async function webdavDownload(config: WebDavConfig): Promise<WebDavResult<string>> {
  try {
    const url = resolveConfiguredUrl(config, 'file')
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(config),
    })
    if (res.status === 404)
      return { ok: false, status: 404, error: 'not_found' }
    if (!res.ok)
      return { ok: false, status: res.status, error: res.statusText }
    const text = await res.text()
    return { ok: true, status: res.status, data: text }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

export async function webdavDelete(config: WebDavConfig): Promise<WebDavResult> {
  try {
    if (isDirectoryTarget(config.path))
      return { ok: false, status: 0, error: 'invalid_delete_target' }

    const url = resolveConfiguredUrl(config, 'file')
    const res = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(config),
    })

    if ((res.status >= 200 && res.status < 300) || res.status === 404)
      return { ok: true, status: res.status }

    return { ok: false, status: res.status, error: res.statusText || 'delete_failed' }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}
