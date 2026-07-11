import { describe, expect, it } from 'vitest'

import type { SettingsBackupSummary, WebDavDirectoryEntry } from '../logic/webdavBackups'
import {
  buildBackupFilename,
  buildRetentionPlan,
  detectXmlParseError,
  DIRECTORY_PROPS_REQUEST,
  isManagedBackupFilename,
  MAX_BACKUP_NAME_ATTEMPTS,
  mergeVersionedWithLegacy,
  parseDirectoryListing,
  parseSequenceFromFilename,
  parseTimestampFromFilename,
  RETENTION_LIMIT,
} from '../logic/webdavBackups'

const MANAGED_DIR_URL = 'https://example.com/dav/bewly/'
const REQUEST_DIR_PATH = '/bewly/'

function xmlResponse(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>${body}`
}

function multistatus(responses: string, prefix = 'd'): string {
  return xmlResponse(`<${prefix}:multistatus xmlns:${prefix}="DAV:">${responses}</${prefix}:multistatus>`)
}

function parseListing(
  xml: string,
  overrides: Partial<{ directoryUrl: string, requestDirectoryPath: string }> = {},
) {
  return parseDirectoryListing({
    xml,
    directoryUrl: overrides.directoryUrl ?? MANAGED_DIR_URL,
    requestDirectoryPath: overrides.requestDirectoryPath ?? REQUEST_DIR_PATH,
  })
}

describe('webdavBackups managed filename generation', () => {
  it('builds a fixed-prefix, sorted UTC-millisecond filename with a width-4 sequence', () => {
    const name = buildBackupFilename(Date.UTC(2026, 6, 11, 4, 29, 0, 123), 1)
    expect(name).toBe('bewly-settings-20260711T042900.123Z-0001.json')
  })

  it('increments the sequence for the same millisecond without padding gaps', () => {
    const first = buildBackupFilename(1_700_000_000_000, 1)
    const tenth = buildBackupFilename(1_700_000_000_000, 10)
    expect(first).toMatch(/-0001\.json$/)
    expect(tenth).toMatch(/-0010\.json$/)
  })

  it('recognizes files with the managed prefix as managed backups', () => {
    expect(isManagedBackupFilename('bewly-settings-20260711T042900.123Z-0001.json')).toBe(true)
  })

  it('rejects unmanaged file names, directories, and mimics', () => {
    expect(isManagedBackupFilename('/bewly/settings.json')).toBe(false)
    expect(isManagedBackupFilename('notes.txt')).toBe(false)
    expect(isManagedBackupFilename('bewly-settings-20260711T042900.123Z-0001.json.tmp')).toBe(false)
    expect(isManagedBackupFilename('bewly-settings.json')).toBe(false)
  })

  it('parses the UTC millisecond timestamp back out of a managed filename', () => {
    const ms = Date.UTC(2026, 6, 11, 4, 29, 0, 123)
    const name = buildBackupFilename(ms, 7)
    expect(parseTimestampFromFilename(name)).toBe(ms)
  })

  it('round-trips a valid pre-1970 timestamp without throwing', () => {
    const name = buildBackupFilename(-1, 1)

    expect(name).toBe('bewly-settings-19691231T235959.999Z-0001.json')
    expect(() => parseTimestampFromFilename(name)).not.toThrow()
    expect(parseTimestampFromFilename(name)).toBe(-1)
  })

  it('parses the trailing sequence number back out of a managed filename', () => {
    const ms = Date.UTC(2026, 6, 11, 4, 29, 0, 123)
    const name = buildBackupFilename(ms, 10)
    expect(parseSequenceFromFilename(name)).toBe(10)
  })

  it('parses the sequence for same-millisecond stability via buildBackupFilename round-trip', () => {
    const ms = Date.UTC(2026, 6, 11, 4, 29, 0, 123)
    const a = buildBackupFilename(ms, 1)
    const b = buildBackupFilename(ms, 2)
    expect(isManagedBackupFilename(a)).toBe(true)
    expect(isManagedBackupFilename(b)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('rejects auto-carrying dates like February 31 when parsing the timestamp', () => {
    expect(parseTimestampFromFilename('bewly-settings-20260231T000000.000Z-0001.json')).toBeNull()
  })

  it('rejects a malformed managed filename even if it shares the prefix', () => {
    expect(parseTimestampFromFilename('bewly-settings-20261319T000000.000Z-0001.json')).toBeNull()
    expect(parseTimestampFromFilename('bewly-settings-YYYYMMDDTHHMMSS.SSSZ-0001.json')).toBeNull()
  })

  it('rejects managed filenames whose sequence is 0000 or outside 0001-0010', () => {
    const tooLow = 'bewly-settings-20260711T042900.123Z-0000.json'
    const tooHigh = `bewly-settings-20260711T042900.123Z-${String(MAX_BACKUP_NAME_ATTEMPTS + 1).padStart(4, '0')}.json`

    expect(parseTimestampFromFilename(tooLow)).toBeNull()
    expect(parseSequenceFromFilename(tooLow)).toBeNull()
    expect(isManagedBackupFilename(tooLow)).toBe(false)

    expect(parseTimestampFromFilename(tooHigh)).toBeNull()
    expect(parseSequenceFromFilename(tooHigh)).toBeNull()
    expect(isManagedBackupFilename(tooHigh)).toBe(false)
  })
})

describe('webdavBackups PROPFIND XML parsing', () => {
  it('skips the directory self entry and only keeps direct child files', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/</d:href>
        <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
      </d:response>
      <d:response>
        <d:href>/dav/bewly/bewly-settings-20260711T042900.123Z-0001.json</d:href>
        <d:propstat><d:prop><d:resourcetype/><d:getcontentlength>1234</d:getcontentlength><d:getlastmodified>Fri, 11 Jul 2026 04:29:00 GMT</d:getlastmodified></d:prop></d:propstat>
      </d:response>
      <d:response>
        <d:href>/dav/bewly/subdir/</d:href>
        <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].fileName).toBe('bewly-settings-20260711T042900.123Z-0001.json')
      expect(result.entries[0].isCollection).toBe(false)
      expect(result.entries[0].contentLength).toBe(1234)
      expect(result.entries[0].lastModifiedMs).toBe(new Date('Fri, 11 Jul 2026 04:29:00 GMT').getTime())
    }
  })

  it('accepts absolute-URI hrefs returned by some servers', () => {
    const body = multistatus(`
      <d:response>
        <d:href>https://example.com/dav/bewly/</d:href>
        <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
      </d:response>
      <d:response>
        <d:href>https://example.com/dav/bewly/bewly-settings-20260711T042900.123Z-0002.json</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].fileName).toBe('bewly-settings-20260711T042900.123Z-0002.json')
      expect(result.entries[0].requestPath).toBe('/bewly/bewly-settings-20260711T042900.123Z-0002.json')
    }
  })

  it('accepts `D:` prefix variants without hardcoding `d:`', () => {
    const body = multistatus(`
      <D:response>
        <D:href>/dav/bewly/</D:href>
        <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
      </D:response>
      <D:response>
        <D:href>/dav/bewly/bewly-settings-20260711T042900.123Z-0003.json</D:href>
        <D:propstat><D:prop><D:resourcetype/></D:prop></D:propstat>
      </D:response>
    `, 'D')

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.entries[0].fileName).toBe('bewly-settings-20260711T042900.123Z-0003.json')
  })

  it('accepts default-namespace multistatus (no prefix) without hardcoding any prefix string', () => {
    const body = xmlResponse(`
      <multistatus xmlns="DAV:">
        <response>
          <href>/dav/bewly/</href>
          <propstat><prop><resourcetype><collection/></resourcetype></prop></propstat>
        </response>
        <response>
          <href>/dav/bewly/bewly-settings-20260711T042900.123Z-0004.json</href>
          <propstat><prop><resourcetype/></prop></propstat>
        </response>
      </multistatus>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.entries[0].fileName).toBe('bewly-settings-20260711T042900.123Z-0004.json')
  })

  it('tolerates a single response with multiple propstats where some properties return 404', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/bewly-settings-20260711T042900.123Z-0005.json</d:href>
        <d:propstat>
          <d:prop><d:resourcetype/><d:getlastmodified>Fri, 11 Jul 2026 04:29:00 GMT</d:getlastmodified></d:prop>
          <d:status>HTTP/1.1 200 OK</d:status>
        </d:propstat>
        <d:propstat>
          <d:prop><d:getcontentlength/></d:prop>
          <d:status>HTTP/1.1 404 Not Found</d:status>
        </d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].lastModifiedMs).toBe(new Date('Fri, 11 Jul 2026 04:29:00 GMT').getTime())
      expect(result.entries[0].contentLength).toBeUndefined()
    }
  })

  it('separates URI percent-encoding from XML entity decoding', () => {
    // XML entity &amp; decodes to `&`, then URI percent-decoding turns `%20`
    // into spaces for model/display use. The request path is rebuilt from the
    // validated filename instead of reusing raw href text with query/fragment.
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/notes%20%26%20drafts.txt?download=1&amp;ignored=1#fragment</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries[0].fileName).toBe('notes & drafts.txt')
      expect(result.entries[0].requestPath).toBe('/bewly/notes & drafts.txt')
    }
  })

  it('returns the raw logical request path instead of the server base-url pathname or encoded href text', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/settings%20backup.json</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body, {
      directoryUrl: 'https://example.com/dav/bewly/',
      requestDirectoryPath: '/bewly/',
    })

    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.entries[0].requestPath).toBe('/bewly/settings backup.json')
  })

  it('rejects malformed percent-encoding in a direct-child filename', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/notes%E0%A4%A.txt</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('unsupported_href_format')
  })

  it('rejects cross-origin hrefs that are not on the configured server origin', () => {
    const body = multistatus(`
      <d:response>
        <d:href>https://attacker.example/dav/bewly/bewly-settings-20260711T042900.123Z-0006.json</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('unsupported_href_format')
  })

  it('rejects adjacent-prefix hrefs that only share a path prefix with the target directory', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly-other/bewly-settings-20260711T042900.123Z-0007.json</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('unsupported_href_format')
  })

  it('rejects malformed XML by surfacing a parse error', () => {
    const result = parseListing('<not-xml><d:response>')

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('invalid_multistatus')
  })

  it('skips top-level non-2xx resource responses instead of treating them as files', () => {
    const body = multistatus(`
      <d:response>
        <d:href>/dav/bewly/missing.json</d:href>
        <d:status>HTTP/1.1 404 Not Found</d:status>
      </d:response>
      <d:response>
        <d:href>/dav/bewly/bewly-settings-20260711T042900.123Z-0008.json</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].fileName).toBe('bewly-settings-20260711T042900.123Z-0008.json')
    }
  })

  it.each([
    '/dav/bewly/nested%2Fname.json',
    '/dav/bewly/bad%5Cname.json',
    '/dav/bewly/bad%00name.json',
  ])('rejects filenames that decode to forbidden path characters: %s', (href) => {
    const body = multistatus(`
      <d:response>
        <d:href>${href}</d:href>
        <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
      </d:response>
    `)

    const result = parseListing(body)

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('unsupported_href_format')
  })

  it('detects a `parsererror` element from DOMParser as a parse failure', () => {
    const body = xmlResponse('<parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml">boom</parsererror>')

    expect(detectXmlParseError(body)).toBe(true)
  })
})

describe('webdavBackups merge and retention plan', () => {
  function versionedEntry(ms: number, seq = 1): WebDavDirectoryEntry {
    const fileName = buildBackupFilename(ms, seq)
    const path = `/bewly/${fileName}`
    return {
      requestPath: path,
      fileName,
      isCollection: false,
    }
  }

  function versionedSortKey(ms: number, seq = 1): SettingsBackupSummary {
    const entry = versionedEntry(ms, seq)
    return {
      id: entry.requestPath,
      requestPath: entry.requestPath,
      fileName: entry.fileName,
      source: 'versioned',
      timestampMs: ms,
      sequence: seq,
    }
  }

  it('only merges a legacy candidate that exactly matches the locator path', () => {
    const entries: WebDavDirectoryEntry[] = [
      { fileName: 'bewly-settings-20260711T042900.123Z-0001.json', requestPath: '/bewly/bewly-settings-20260711T042900.123Z-0001.json', isCollection: false },
      { fileName: 'settings.json', requestPath: '/bewly/settings.json', isCollection: false },
      { fileName: 'random.json', requestPath: '/bewly/random.json', isCollection: false },
    ]

    const result = mergeVersionedWithLegacy({
      entries,
      legacyFilePath: '/bewly/settings.json',
      legacyTimestampMs: 1_000,
    })

    expect(result.backups).toHaveLength(2)
    expect(result.warnings).not.toContain('legacy_unreadable')
    const legacy = result.backups.find(b => b.source === 'legacy')
    expect(legacy?.requestPath).toBe('/bewly/settings.json')
    expect(legacy?.timestampMs).toBe(1_000)
  })

  it('sorts newest-first by envelope timestamp', () => {
    const backups = [
      versionedEntry(100),
      versionedEntry(101),
    ]

    const result = mergeVersionedWithLegacy({ entries: backups, legacyFilePath: '', legacyTimestampMs: 0 })

    expect(result.backups[0].timestampMs).toBe(101)
    expect(result.backups[1].timestampMs).toBe(100)
  })

  it('uses legacy only when GET-provided V1 timestamp is present; never substitutes getlastmodified', () => {
    // The pure merge helper must never fabricate a legacy timestamp from
    // lastModified when no envelope timestamp is supplied.
    const entries: WebDavDirectoryEntry[] = [{ fileName: 'settings.json', requestPath: '/bewly/settings.json', isCollection: false, lastModifiedMs: 555 }]
    const result = mergeVersionedWithLegacy({
      entries,
      legacyFilePath: '/bewly/settings.json',
      legacyTimestampMs: null,
    })

    expect(result.backups.find(b => b.source === 'legacy')).toBeUndefined()
    expect(result.warnings).toContain('legacy_unreadable')
  })

  it('does not warn when a local legacy locator is absent from the directory listing', () => {
    const entries: WebDavDirectoryEntry[] = [
      { fileName: 'bewly-settings-20260711T042900.123Z-0001.json', requestPath: '/bewly/bewly-settings-20260711T042900.123Z-0001.json', isCollection: false },
    ]

    const result = mergeVersionedWithLegacy({
      entries,
      legacyFilePath: '/bewly/settings.json',
      legacyTimestampMs: null,
    })

    expect(result.backups).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  it('breaks ties deterministically by requestPath after timestamp and sequence', () => {
    const backups: SettingsBackupSummary[] = [
      { id: '/bewly/b.json', requestPath: '/bewly/b.json', fileName: 'b.json', source: 'legacy', timestampMs: 1_000, sequence: 1 },
      { id: '/bewly/z.json', requestPath: '/bewly/z.json', fileName: 'z.json', source: 'legacy', timestampMs: 1_000, sequence: 2 },
      { id: '/bewly/c.json', requestPath: '/bewly/c.json', fileName: 'c.json', source: 'legacy', timestampMs: 1_001, sequence: 0 },
      { id: '/bewly/a.json', requestPath: '/bewly/a.json', fileName: 'a.json', source: 'legacy', timestampMs: 1_000, sequence: 1 },
    ]

    const plan = buildRetentionPlan(backups)

    expect(plan.keep.map(backup => backup.requestPath)).toEqual([
      '/bewly/c.json',
      '/bewly/z.json',
      '/bewly/a.json',
      '/bewly/b.json',
    ])
  })

  it('returns a retention plan with all extra oldest items when there are 21 backups', () => {
    const backups = Array.from({ length: 21 }, (_, i) => versionedSortKey(1000 - i))

    const plan = buildRetentionPlan(backups)

    expect(plan.keep).toHaveLength(20)
    expect(plan.delete).toHaveLength(1)
    expect(plan.delete[0].timestampMs).toBe(980)
    expect(backups).toHaveLength(21) // input not mutated
  })

  it('returns a retention plan deleting all extras beyond 20 even when there are 22+ backups', () => {
    const backups = Array.from({ length: 23 }, (_, i) => versionedSortKey(1000 - i))

    const plan = buildRetentionPlan(backups)

    expect(plan.keep).toHaveLength(RETENTION_LIMIT)
    expect(plan.delete.map(b => b.timestampMs)).toEqual([978, 979, 980])
    expect(backups).toHaveLength(23)
  })

  it('exposes the RFC-minimal DAV property request set used for directory listing', () => {
    expect(DIRECTORY_PROPS_REQUEST).toContain('resourcetype')
    expect(DIRECTORY_PROPS_REQUEST).toContain('getlastmodified')
    expect(DIRECTORY_PROPS_REQUEST).toContain('getcontentlength')
  })
})
