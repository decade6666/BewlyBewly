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

function resolveUrl(config: WebDavConfig): string {
  const base = config.url.replace(/\/+$/, '')
  const path = config.path.startsWith('/') ? config.path : `/${config.path}`
  return `${base}${path}`
}

function parentPath(filePath: string): string {
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  const segments = normalizedPath.replace(/\/+$/, '').split('/').filter(Boolean)
  segments.pop()
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

export async function webdavTest(config: WebDavConfig): Promise<WebDavResult> {
  try {
    const base = config.url.replace(/\/+$/, '')
    const res = await fetch(base, {
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

async function ensureParentDir(config: WebDavConfig): Promise<void> {
  const parent = parentPath(config.path)
  if (parent === '/' || parent === '')
    return

  const base = config.url.replace(/\/+$/, '')
  const segments = parent.split('/').filter(Boolean)
  let currentPath = ''

  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`
    const dirUrl = `${base}${currentPath}/`

    const check = await fetch(dirUrl, {
      method: 'PROPFIND',
      headers: { ...buildHeaders(config), 'Depth': '0' },
    }).catch((error) => {
      console.warn(`WebDAV PROPFIND ${currentPath} failed:`, error)
      return null
    })

    if (check && (check.status === 207 || check.status === 200))
      continue

    if (check && check.status !== 404) {
      console.warn(`WebDAV PROPFIND ${currentPath} returned HTTP ${check.status}`)
      continue
    }

    const create = await fetch(dirUrl, {
      method: 'MKCOL',
      headers: buildHeaders(config),
    }).catch((error) => {
      console.warn(`WebDAV MKCOL ${currentPath} failed:`, error)
      return null
    })

    if (!create || create.status === 201 || create.status === 405 || create.status === 301)
      continue

    console.warn(`WebDAV MKCOL ${currentPath} returned HTTP ${create.status}`)
  }
}

export async function webdavUpload(config: WebDavConfig, data: string): Promise<WebDavResult> {
  try {
    await ensureParentDir(config)
    const url = resolveUrl(config)
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...buildHeaders(config),
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: data,
    })
    return { ok: res.status >= 200 && res.status < 300, status: res.status }
  }
  catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

export async function webdavDownload(config: WebDavConfig): Promise<WebDavResult<string>> {
  try {
    const url = resolveUrl(config)
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
