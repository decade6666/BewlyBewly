# WebDAV Synchronization Path Research

## Summary

Automatic synchronization is isolated to content-script startup and settings-change watchers. Removing those triggers and their conflict-tracking state leaves manual connection testing, upload, and download intact through the existing background WebDAV channel. The background listener, WebDAV client, and `<all_urls>` permission remain required for user-configured manual endpoints.

## Automatic upload path

1. `src/contentScripts/index.ts:32-43` initializes synchronization after DOM readiness on a non-iframe Linux.do page.
2. `src/contentScripts/index.ts:45-66` calls `setupAutoSync()` and registers the startup-download watcher.
3. `src/logic/settingsSync.ts:18-51` builds the synchronizable settings state while excluding local WebDAV configuration.
4. `src/logic/settingsSync.ts:145-171` deeply watches that state. When `webdavEnabled && webdavAutoSync && webdavUrl`, it records `webdavLocalModifiedTime`, waits two seconds, and calls `uploadSettings()`.
5. `src/logic/settingsSync.ts:77-91` creates the version-1 settings/blocked-words envelope.
6. `src/logic/webdav.ts:24-65`, `src/background/messageListeners/webdav.ts:13-47`, and `src/logic/webdav.ts:111-172` route the request through the background worker and write it with WebDAV `PUT`, creating parent collections as needed.

## Automatic startup download path

- `src/contentScripts/index.ts:48-65` immediately watches WebDAV enabled/automatic-sync/URL state until asynchronously persisted settings are hydrated, then runs once.
- `src/logic/settingsSync.ts:174-182` skips when configuration is incomplete or `webdavLocalModifiedTime > webdavLastSyncTime`; otherwise it calls `downloadSettings({ onlyIfNewer: true })`.
- `src/logic/settingsSync.ts:94-137` applies only a strictly newer remote envelope in automatic mode, preserves local WebDAV configuration, replaces blocked words, and updates timestamps.

## Manual behavior that remains

- Both `src/components/Settings/DataSync/DataSync.vue:5-79` and `src/contentScripts/views/App.vue:356-423` call the same manual test, upload, and download functions.
- Manual upload (`src/logic/settingsSync.ts:77-91`) does not require `webdavAutoSync`.
- Manual download (`src/logic/settingsSync.ts:94-118`) does not request `onlyIfNewer`, so an explicit user action can apply an equal-time or older remote snapshot.
- `src/logic/webdav.ts:52-55,92-109` tests the server root via a background `PROPFIND`.
- `src/logic/webdav.ts:24-191`, `src/background/messageListeners/webdav.ts:13-47`, `src/background/index.ts:3-13`, and `src/manifest.ts:49-58` remain required for manual WebDAV and arbitrary user-configured endpoints.

## Obsolete automatic-sync state and code

### Persisted fields

- `webdavAutoSync`
- `webdavLocalModifiedTime`

Definitions/defaults: `src/logic/storage.ts:122-130,238-246`.

### Automatic-only logic

The following can be removed or simplified after verifying manual call contracts:

- `applyingRemote`
- `lastSyncedSnapshot`
- `buildSyncSnapshot()`
- `SyncResult.skipped`
- `downloadSettings({ onlyIfNewer })` and its newer-only branch
- clearing `webdavLocalModifiedTime` after download
- `autoSyncTimer`
- `autoSyncUnwatch`
- `setupAutoSync()`
- `autoDownloadOnStartup()`

Evidence: `src/logic/settingsSync.ts:54-75,87-90,94-137,142-182`.

`buildSyncState()` must remain because manual upload uses it (`src/logic/settingsSync.ts:47-51,77-86`).

### Lifecycle trigger

Remove the automatic-sync imports, `setupSettingsSync()` call, and its function from `src/contentScripts/index.ts:3-8,36-66`. The module's other `watch` usage at `src/contentScripts/index.ts:82-90` remains required by homepage cleanup.

### UI and localization

- Remove automatic-sync controls at `src/components/Settings/DataSync/DataSync.vue:106-108` and `src/contentScripts/views/App.vue:725-728`.
- Remove the four inline `webdavAutoSync` labels at `src/contentScripts/views/App.vue:48,96,144,192`.
- Remove `webdav_auto_sync` and `webdav_auto_sync_desc` from `src/_locales/en.yml:289-290`, `src/_locales/cmn-CN.yml:284-285`, `src/_locales/cmn-TW.yml:282-283`, and `src/_locales/jyut.yml:280-281`.
- Preserve manual action, outcome, and last-sync labels.

### Tests

- Replace automatic-sync source assertions at `src/tests/linuxDoMigration.spec.ts:1317,1328-1329`.
- Preserve coverage of manual entry points, blocked-word envelope contents, background messages, and `<all_urls>` at `src/tests/linuxDoMigration.spec.ts:1304-1370`.
- Existing coverage is primarily source-string regression coverage; no behavior test was found for startup download or debounced automatic upload.

## State that remains relevant

- `webdavUrl`, `webdavUsername`, `webdavPassword`, and `webdavPath` are needed for manual operations.
- `webdavLastSyncTime` remains updated by successful manual upload/download and is displayed by both UI surfaces (`src/logic/settingsSync.ts:87-90,131-133`; `src/components/Settings/DataSync/DataSync.vue:17-21`; `src/contentScripts/views/App.vue:239-244`).
- `webdavEnabled` currently gates configuration visibility; it becomes obsolete only if product intent replaces this gate with an always-available configuration dialog.
- The version-1 remote envelope remains compatible and need not change.

## Migration and compatibility

- Settings are loaded by merging defaults into the local `settings` key (`src/logic/storage.ts:11,264`).
- Existing migration support only cleans an unrelated legacy field (`src/logic/settingsMigration.ts:1-45`; `src/logic/storage.ts:249-266,329-338`).
- Removing fields from TypeScript/defaults does not explicitly delete already persisted `webdavAutoSync` and `webdavLocalModifiedTime` keys.
- The remote envelope already excludes WebDAV configuration and synchronization metadata (`src/logic/settingsSync.ts:18-37`), so no envelope-version migration is needed.
- Explicitly deleting legacy automatic-sync keys prevents them from reactivating after a downgrade; retaining inert keys means a downgraded client can restore its former automatic-sync state.
- Older devices that have not upgraded can still automatically write the shared remote file; the version-1 wire format cannot disable them remotely.

## Product decisions still required

1. Whether `webdavEnabled` remains a primary-surface gate or the dialog entry itself replaces it.
2. Whether `webdavLastSyncTime` remains visible for manual operations.
3. Whether obsolete persisted keys are explicitly cleaned on upgrade or left inert for downgrade compatibility.
